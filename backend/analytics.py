"""
Analytics Computation Functions using Pandas
Functions to compute analytics from shipping data stored in Redis
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime

from backend.redis_client import (
    get_shipping_data_from_redis,
    save_analytics_to_redis,
    build_analytics_key
)


def filter_shipping_data(df: pd.DataFrame, filters: Dict[str, Any]) -> pd.DataFrame:
    """Filter shipping data DataFrame based on filter parameters"""
    filtered_df = df.copy()
    
    # Date range filter
    if filters.get('startDate') or filters.get('endDate'):
        # Find order date column
        order_date_col = None
        for col in ['order_date', 'order__date', 'shiprocket__created__at', 
                   'shiprocket_created_at', 'channel__created__at', 'created_at']:
            if col in filtered_df.columns:
                order_date_col = col
                break
        
        if order_date_col:
            # Convert to datetime if not already
            if filtered_df[order_date_col].dtype == 'object':
                filtered_df[order_date_col] = pd.to_datetime(
                    filtered_df[order_date_col], errors='coerce'
                )
            
            if filters.get('startDate'):
                start_date = pd.to_datetime(filters['startDate'])
                filtered_df = filtered_df[filtered_df[order_date_col] >= start_date]
            
            if filters.get('endDate'):
                end_date = pd.to_datetime(filters['endDate'])
                filtered_df = filtered_df[filtered_df[order_date_col] <= end_date]
    
    # Order status filter
    if filters.get('orderStatus') and filters['orderStatus'] != 'All':
        filter_status = str(filters['orderStatus']).upper().strip()
        
        # Get status column
        status_col = None
        for col in ['original_status', 'status', 'delivery_status', 'current_status']:
            if col in filtered_df.columns:
                status_col = col
                break
        
        if status_col:
            # Status mappings
            status_mappings = {
                'CANCELED': ['CANCELED', 'CANCELLED', 'CANCEL', 'CANCELLATION'],
                'DELIVERED': ['DELIVERED', 'DEL'],
                'DESTROYED': ['DESTROYED', 'DESTROY'],
                'IN TRANSIT': ['IN TRANSIT', 'IN_TRANSIT', 'IN-TRANSIT', 'INTRANSIT'],
                'LOST': ['LOST'],
                'OUT FOR DELIVERY': ['OUT FOR DELIVERY', 'OFD', 'OUT_FOR_DELIVERY'],
                'RTO DELIVERED': ['RTO DELIVERED', 'RTO_DELIVERED'],
                'RTO INITIATED': ['RTO INITIATED', 'RTO_INITIATED', 'RTO'],
                'UNDELIVERED': ['UNDELIVERED', 'NDR', 'PENDING'],
            }
            
            def matches_status(status_val):
                if pd.isna(status_val) or status_val == '':
                    return False
                status_str = str(status_val).upper().strip()
                
                if filter_status in status_mappings:
                    return status_str in status_mappings[filter_status]
                
                # Exact match
                normalized_status = status_str.replace('_', ' ').replace('-', ' ')
                normalized_filter = filter_status.replace('_', ' ').replace('-', ' ')
                return normalized_status == normalized_filter
            
            filtered_df = filtered_df[filtered_df[status_col].apply(matches_status)]
    
    # Payment method filter
    if filters.get('paymentMethod') and filters['paymentMethod'] != 'All':
        payment_col = None
        for col in ['payment_method', 'payment__method', 'paymentmethod']:
            if col in filtered_df.columns:
                payment_col = col
                break
        
        if payment_col:
            payment_method = str(filters['paymentMethod']).upper()
            
            if payment_method == 'NAN':
                filtered_df = filtered_df[
                    filtered_df[payment_col].isna() |
                    (filtered_df[payment_col].astype(str).str.upper().isin(['NONE', 'N/A', '']))
                ]
            elif payment_method == 'COD':
                filtered_df = filtered_df[
                    filtered_df[payment_col].astype(str).str.upper().str.contains('COD|CASH', na=False)
                ]
            elif payment_method == 'ONLINE':
                filtered_df = filtered_df[
                    filtered_df[payment_col].astype(str).str.upper().str.contains('ONLINE|PREPAID|PAID', na=False)
                ]
    
    # Channel filter
    if filters.get('channel') and filters['channel'] != 'All':
        channel_col = None
        for col in ['channel', 'Channel', 'channel__']:
            if col in filtered_df.columns:
                channel_col = col
                break
        
        if channel_col:
            filtered_df = filtered_df[filtered_df[channel_col] == filters['channel']]
    
    # SKU filter
    if filters.get('sku') and filters['sku'] != 'All':
        sku_list = filters['sku'] if isinstance(filters['sku'], list) else [filters['sku']]
        sku_col = None
        for col in ['master_s_k_u', 'master_sku', 'sku', 'channel_s_k_u', 'channel_sku']:
            if col in filtered_df.columns:
                sku_col = col
                break
        
        if sku_col:
            filtered_df = filtered_df[filtered_df[sku_col].isin(sku_list)]
    
    # Product name filter
    if filters.get('productName') and filters['productName'] != 'All':
        product_list = filters['productName'] if isinstance(filters['productName'], list) else [filters['productName']]
        product_col = None
        for col in ['product_name', 'product__name']:
            if col in filtered_df.columns:
                product_col = col
                break
        
        if product_col:
            filtered_df = filtered_df[filtered_df[product_col].isin(product_list)]
    
    return filtered_df


def compute_weekly_summary(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute weekly summary analytics using pandas"""
    if df.empty:
        return []
    
    # Group by order_week
    grouped = df.groupby('order_week', dropna=False)
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    # Convert status to uppercase for comparison
    df['_status_upper'] = df[status_col].astype(str).str.upper().str.strip()
    
    # Compute metrics
    result = []
    for week, week_df in grouped:
        if pd.isna(week):
            week = 'Unknown'
        
        total_orders = len(week_df)
        
        # Count statuses
        del_count = (week_df['_status_upper'] == 'DELIVERED').sum()
        ofd_count = (week_df['_status_upper'].isin(['OFD', 'OUT FOR DELIVERY'])).sum()
        ndr_count = (week_df['_status_upper'] == 'NDR').sum()
        rto_count = (week_df['_status_upper'].str.contains('RTO', na=False)).sum()
        
        # GMV - only for delivered orders
        delivered_df = week_df[week_df['_status_upper'] == 'DELIVERED']
        order_value_col = None
        for col in ['order_value', 'gmv_amount', 'order_total', 'order__total', 'total_order_value']:
            if col in delivered_df.columns:
                order_value_col = col
                break
        
        total_order_value = 0
        if order_value_col:
            total_order_value = delivered_df[order_value_col].fillna(0).sum()
        
        # NDR delivered after
        ndr_delivered_after = (
            (week_df['ndr_flag'] == True) & 
            (week_df['_status_upper'] == 'DELIVERED')
        ).sum()
        
        # FAD (First Attempt Delivery)
        fad_count = (
            (week_df['_status_upper'] == 'DELIVERED') & 
            (week_df['ndr_flag'] != True)
        ).sum()
        
        # TAT
        tat_sum = week_df['total_tat'].fillna(0).sum()
        tat_count = week_df['total_tat'].notna().sum()
        avg_total_tat = tat_sum / tat_count if tat_count > 0 else 0
        
        # Total NDR
        total_ndr = week_df['ndr_flag'].sum()
        
        # Calculate percentages
        avg_order_value = total_order_value / del_count if del_count > 0 else 0
        ndr_rate_percent = (total_ndr / total_orders * 100) if total_orders > 0 else 0
        ndr_conversion_percent = (ndr_delivered_after / total_ndr * 100) if total_ndr > 0 else 0
        
        result.append({
            'order_week': str(week),
            'total_orders': int(total_orders),
            'total_order_value': float(total_order_value),
            'avg_order_value': float(avg_order_value),
            'total_ndr': int(total_ndr),
            'ndr_delivered_after': int(ndr_delivered_after),
            'ndr_rate_percent': float(ndr_rate_percent),
            'ndr_conversion_percent': float(ndr_conversion_percent),
            'fad_count': int(fad_count),
            'ofd_count': int(ofd_count),
            'del_count': int(del_count),
            'ndr_count': int(ndr_count),
            'rto_count': int(rto_count),
            'avg_total_tat': float(avg_total_tat),
        })
    
    # Clean up temporary column
    df.drop('_status_upper', axis=1, errors='ignore', inplace=True)
    
    # Sort by order_week
    result.sort(key=lambda x: x['order_week'])
    return result


def compute_ndr_weekly(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute NDR weekly analytics"""
    if df.empty:
        return []
    
    # Filter only NDR records
    ndr_df = df[df['ndr_flag'] == True].copy()
    
    if ndr_df.empty:
        return []
    
    # Group by order_week
    grouped = ndr_df.groupby('order_week', dropna=False)
    
    result = []
    for week, week_df in grouped:
        if pd.isna(week):
            week = 'Unknown'
        
        total_ndr = len(week_df)
        
        # NDR delivered after
        ndr_delivered_after = (week_df['delivery_status'] == 'DELIVERED').sum()
        
        # NDR reasons
        ndr_reason_col = None
        for col in ['latest__n_d_r__reason', 'latest_ndr_reason', 'ndr_reason']:
            if col in week_df.columns:
                ndr_reason_col = col
                break
        
        ndr_reasons = {}
        if ndr_reason_col:
            reason_counts = week_df[ndr_reason_col].value_counts().to_dict()
            ndr_reasons = {str(k): int(v) for k, v in reason_counts.items()}
        else:
            ndr_reasons = {'Unknown': total_ndr}
        
        # Calculate percentages
        week_total_orders = len(df[df['order_week'] == week])
        ndr_rate_percent = (total_ndr / week_total_orders * 100) if week_total_orders > 0 else 0
        ndr_conversion_percent = (ndr_delivered_after / total_ndr * 100) if total_ndr > 0 else 0
        
        result.append({
            'order_week': str(week),
            'total_ndr': int(total_ndr),
            'ndr_delivered_after': int(ndr_delivered_after),
            'ndr_rate_percent': float(ndr_rate_percent),
            'ndr_conversion_percent': float(ndr_conversion_percent),
            'ndr_reasons': ndr_reasons,
        })
    
    result.sort(key=lambda x: x['order_week'])
    return result


def compute_state_performance(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute state performance analytics"""
    if df.empty:
        return []
    
    # Group by state
    state_col = None
    for col in ['state', 'address__state']:
        if col in df.columns:
            state_col = col
            break
    
    if not state_col:
        return []
    
    df['_state'] = df[state_col].fillna('Unknown')
    grouped = df.groupby('_state', dropna=False)
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    df['_status_upper'] = df[status_col].astype(str).str.upper().str.strip()
    
    result = []
    total_orders_all = len(df)
    
    for state, state_df in grouped:
        if pd.isna(state):
            state = 'Unknown'
        
        total_orders = len(state_df)
        
        # Count statuses
        del_count = (state_df['_status_upper'] == 'DELIVERED').sum()
        rto_count = (state_df['_status_upper'].str.contains('RTO', na=False)).sum()
        ndr_count = (state_df['_status_upper'] == 'NDR').sum()
        
        # Calculate percentages
        delivered_percent = (del_count / total_orders * 100) if total_orders > 0 else 0
        rto_percent = (rto_count / total_orders * 100) if total_orders > 0 else 0
        ndr_percent = (ndr_count / total_orders * 100) if total_orders > 0 else 0
        order_share = (total_orders / total_orders_all * 100) if total_orders_all > 0 else 0
        
        result.append({
            'state': str(state),
            'total_orders': int(total_orders),
            'del_count': int(del_count),
            'rto_count': int(rto_count),
            'ndr_count': int(ndr_count),
            'delivered_percent': float(delivered_percent),
            'rto_percent': float(rto_percent),
            'ndr_percent': float(ndr_percent),
            'order_share': float(order_share),
        })
    
    # Clean up temporary columns
    df.drop(['_state', '_status_upper'], axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['total_orders'], reverse=True)
    return result


def compute_category_share(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute category share analytics"""
    if df.empty:
        return []
    
    category_col = None
    for col in ['category', 'product__category']:
        if col in df.columns:
            category_col = col
            break
    
    if not category_col:
        return []
    
    df['_category'] = df[category_col].fillna('Uncategorized')
    grouped = df.groupby('_category', dropna=False)
    
    result = []
    for category, cat_df in grouped:
        if pd.isna(category):
            category = 'Uncategorized'
        
        total_orders = len(cat_df)
        
        # Total order value
        order_value_col = None
        for col in ['order_value', 'gmv_amount', 'order_total']:
            if col in cat_df.columns:
                order_value_col = col
                break
        
        total_order_value = 0
        if order_value_col:
            total_order_value = cat_df[order_value_col].fillna(0).sum()
        
        result.append({
            'categoryname': str(category),
            'total_orders': int(total_orders),
            'total_order_value': float(total_order_value),
        })
    
    # Clean up
    df.drop('_category', axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['total_orders'], reverse=True)
    return result


def compute_product_analysis(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute product analysis analytics"""
    if df.empty:
        return []
    
    product_col = None
    for col in ['product_name', 'product__name']:
        if col in df.columns:
            product_col = col
            break
    
    if not product_col:
        return []
    
    df['_product_name'] = df[product_col].fillna('Unknown')
    grouped = df.groupby('_product_name', dropna=False)
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    df['_status_upper'] = df[status_col].astype(str).str.upper().str.strip()
    
    result = []
    total_orders_all = len(df)
    
    for product_name, product_df in grouped:
        if pd.isna(product_name):
            product_name = 'Unknown'
        
        orders = len(product_df)
        
        # Count statuses
        delivered = (product_df['_status_upper'] == 'DELIVERED').sum()
        rto = (product_df['_status_upper'].str.contains('RTO', na=False)).sum()
        
        # GMV and margin - only for delivered orders
        delivered_df = product_df[product_df['_status_upper'] == 'DELIVERED']
        
        order_value_col = None
        for col in ['order_value', 'gmv_amount', 'order_total']:
            if col in delivered_df.columns:
                order_value_col = col
                break
        
        gmv = 0
        if order_value_col:
            gmv = delivered_df[order_value_col].fillna(0).sum()
        
        margin_col = None
        for col in ['margin', 'Margin', 'profit', 'Profit', 'profit_margin', 'margin_amount']:
            if col in delivered_df.columns:
                margin_col = col
                break
        
        margin = 0
        if margin_col:
            margin = delivered_df[margin_col].fillna(0).sum()
        
        # Returns (only for delivered orders)
        returned = (
            (product_df['_status_upper'] == 'DELIVERED') &
            (product_df['_status_upper'].str.contains('RETURN', na=False))
        ).sum()
        
        # Calculate percentages
        order_share = (orders / total_orders_all * 100) if total_orders_all > 0 else 0
        delivered_percent = (delivered / orders * 100) if orders > 0 else 0
        rto_percent = (rto / orders * 100) if orders > 0 else 0
        returned_percent = (returned / delivered * 100) if delivered > 0 else 0
        
        result.append({
            'product_name': str(product_name),
            'orders': int(orders),
            'orderShare': float(order_share),
            'gmv': float(gmv),
            'margin': float(margin),
            'deliveredPercent': float(delivered_percent),
            'rtoPercent': float(rto_percent),
            'returnedPercent': float(returned_percent),
        })
    
    # Clean up
    df.drop(['_product_name', '_status_upper'], axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['orders'], reverse=True)
    return result


def compute_cancellation_tracker(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute cancellation tracker analytics"""
    if df.empty:
        return []
    
    # Group by order_week and cancellation reason
    week_col = 'order_week'
    cancellation_col = None
    for col in ['cancellation__reason', 'cancellation_reason']:
        if col in df.columns:
            cancellation_col = col
            break
    
    if not cancellation_col:
        df['_cancellation_bucket'] = df['cancelled_flag'].apply(
            lambda x: 'Cancelled' if x else 'Not Canceled'
        )
    else:
        df['_cancellation_bucket'] = df[cancellation_col].fillna('Not Canceled')
    
    df['_week'] = df[week_col].fillna('Unknown')
    
    grouped = df.groupby(['_week', '_cancellation_bucket'], dropna=False)
    
    result = []
    week_totals = df.groupby('_week').size().to_dict()
    
    for (week, bucket), group_df in grouped:
        if pd.isna(week):
            week = 'Unknown'
        if pd.isna(bucket):
            bucket = 'Not Canceled'
        
        count = len(group_df)
        week_total = week_totals.get(week, 1)
        percentage = (count / week_total * 100) if week_total > 0 else 0
        
        result.append({
            'order_week': str(week),
            'cancellation_bucket': str(bucket),
            'count': int(count),
            'percentage': float(percentage),
        })
    
    # Clean up
    df.drop(['_cancellation_bucket', '_week'], axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: (x['order_week'], x['cancellation_bucket']))
    return result


def compute_channel_share(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute channel share analytics"""
    if df.empty:
        return []
    
    channel_col = None
    for col in ['channel', 'Channel', 'channel__']:
        if col in df.columns:
            channel_col = col
            break
    
    if not channel_col:
        return []
    
    df['_channel'] = df[channel_col].fillna('Unknown')
    grouped = df.groupby('_channel', dropna=False)
    
    result = []
    for channel, channel_df in grouped:
        if pd.isna(channel):
            channel = 'Unknown'
        
        total_orders = len(channel_df)
        
        # Total order value
        order_value_col = None
        for col in ['order_value', 'gmv_amount', 'order_total']:
            if col in channel_df.columns:
                order_value_col = col
                break
        
        total_order_value = 0
        if order_value_col:
            total_order_value = channel_df[order_value_col].fillna(0).sum()
        
        result.append({
            'channel': str(channel),
            'total_orders': int(total_orders),
            'total_order_value': float(total_order_value),
        })
    
    # Clean up
    df.drop('_channel', axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['total_orders'], reverse=True)
    return result


def compute_payment_method(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute payment method distribution"""
    if df.empty:
        return []
    
    payment_col = None
    for col in ['payment_method', 'payment__method', 'paymentmethod']:
        if col in df.columns:
            payment_col = col
            break
    
    if not payment_col:
        return []
    
    def categorize_payment(payment_val):
        if pd.isna(payment_val) or payment_val == '':
            return 'NaN'
        
        payment_upper = str(payment_val).upper()
        if 'COD' in payment_upper or 'CASH' in payment_upper:
            return 'COD'
        elif 'ONLINE' in payment_upper or 'PREPAID' in payment_upper or 'PAID' in payment_upper:
            return 'Online'
        else:
            return 'NaN'
    
    df['_payment_category'] = df[payment_col].apply(categorize_payment)
    
    grouped = df.groupby('_payment_category', dropna=False)
    total = len(df)
    
    result = []
    for category, cat_df in grouped:
        count = len(cat_df)
        value = (count / total * 100) if total > 0 else 0
        
        result.append({
            'name': str(category),
            'value': float(value),
            'count': int(count),
        })
    
    # Clean up
    df.drop('_payment_category', axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['value'], reverse=True)
    return result


def compute_all_analytics(session_id: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Compute all analytics and save to Redis
    Returns: {'success': bool, 'error': str (if failed)}
    """
    try:
        # Get data from Redis
        data = get_shipping_data_from_redis(session_id)
        
        if not data or len(data) == 0:
            return {
                'success': False,
                'error': 'No data found in Redis for session. Data may have expired (30 min TTL) or session ID is invalid.'
            }
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Apply filters if provided
        if filters:
            df = filter_shipping_data(df, filters)
        
        if df.empty:
            # Save empty arrays for all analytics types
            analytics_types = [
                'weekly-summary', 'ndr-weekly', 'state-performance',
                'category-share', 'cancellation-tracker', 'channel-share',
                'payment-method', 'product-analysis'
            ]
            
            filter_obj = filters if filters else None
            for analytics_type in analytics_types:
                key = build_analytics_key(session_id, analytics_type, filter_obj)
                key_part = key.replace(f'analytics:{session_id}:', '')
                save_analytics_to_redis(session_id, key_part, [])
            
            return {'success': True}
        
        # Compute all analytics
        weekly_summary = compute_weekly_summary(df.copy())
        ndr_weekly = compute_ndr_weekly(df.copy())
        state_performance = compute_state_performance(df.copy())
        category_share = compute_category_share(df.copy())
        cancellation_tracker = compute_cancellation_tracker(df.copy())
        channel_share = compute_channel_share(df.copy())
        payment_method = compute_payment_method(df.copy())
        product_analysis = compute_product_analysis(df.copy())
        
        # Save to Redis
        filter_obj = filters if filters else None
        analytics_results = [
            ('weekly-summary', weekly_summary),
            ('ndr-weekly', ndr_weekly),
            ('state-performance', state_performance),
            ('category-share', category_share),
            ('cancellation-tracker', cancellation_tracker),
            ('channel-share', channel_share),
            ('payment-method', payment_method),
            ('product-analysis', product_analysis),
        ]
        
        for analytics_type, analytics_data in analytics_results:
            key = build_analytics_key(session_id, analytics_type, filter_obj)
            key_part = key.replace(f'analytics:{session_id}:', '')
            save_analytics_to_redis(session_id, key_part, analytics_data)
        
        return {'success': True}
    
    except Exception as e:
        import traceback
        print(f'Error computing analytics: {e}')
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e) or 'Failed to compute analytics'
        }
