"""
Analytics Computation Functions using Pandas
Functions to compute analytics from shipping data
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime


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
        
        # Get status column - check multiple possible column names
        status_col = None
        for col in ['original_status', 'status', 'delivery_status', 'current_status', 'Status']:
            if col in filtered_df.columns:
                status_col = col
                break
        
        if status_col:
            # Status mappings for common variations
            status_mappings = {
                'CANCELED': ['CANCELED', 'CANCELLED', 'CANCEL', 'CANCELLATION'],
                'DELIVERED': ['DELIVERED', 'DEL'],
                'DESTROYED': ['DESTROYED', 'DESTROY'],
                'IN TRANSIT': ['IN TRANSIT', 'IN_TRANSIT', 'IN-TRANSIT', 'INTRANSIT', 'IN TRANSIT-AT DESTINATION HUB'],
                'LOST': ['LOST'],
                'OUT FOR DELIVERY': ['OUT FOR DELIVERY', 'OFD', 'OUT_FOR_DELIVERY'],
                'RTO DELIVERED': ['RTO DELIVERED', 'RTO_DELIVERED'],
                'RTO INITIATED': ['RTO INITIATED', 'RTO_INITIATED', 'RTO'],
                'RTO IN TRANSIT': ['RTO IN TRANSIT', 'RTO_IN_TRANSIT'],
                'RTO NDR': ['RTO NDR', 'RTO_NDR'],
                'UNDELIVERED': ['UNDELIVERED', 'NDR', 'PENDING'],
                'PICKUP EXCEPTION': ['PICKUP EXCEPTION', 'PICKUP_EXCEPTION'],
                'PICKED UP': ['PICKED UP', 'PICKED_UP'],
                'REACHED DESTINATION HUB': ['REACHED DESTINATION HUB', 'REACHED_DESTINATION_HUB'],
            }
            
            def matches_status(status_val):
                if pd.isna(status_val) or status_val == '':
                    return False
                status_str = str(status_val).upper().strip()
                
                # Check if filter_status matches any mapped status
                if filter_status in status_mappings:
                    return status_str in status_mappings[filter_status]
                
                # Check if status_str contains filter_status or vice versa (for partial matches)
                normalized_status = status_str.replace('_', ' ').replace('-', ' ').strip()
                normalized_filter = filter_status.replace('_', ' ').replace('-', ' ').strip()
                
                # Exact match
                if normalized_status == normalized_filter:
                    return True
                
                # Partial match (filter is substring of status)
                if normalized_filter in normalized_status:
                    return True
                
                # Partial match (status is substring of filter)
                if normalized_status in normalized_filter:
                    return True
                
                return False
            
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


def compute_sku_analysis(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute SKU analysis analytics"""
    if df.empty:
        return []
    
    # Find SKU column
    sku_col = None
    for col in ['master_s_k_u', 'master_sku', 'sku', 'channel_s_k_u', 'channel_sku']:
        if col in df.columns:
            sku_col = col
            break
    
    if not sku_col:
        return []
    
    df['_sku'] = df[sku_col].fillna('Unknown').astype(str)
    # Filter out invalid SKU values
    df = df[~df['_sku'].isin(['None', 'N/A', 'NA', 'null', 'undefined', ''])]
    
    if df.empty:
        return []
    
    grouped = df.groupby('_sku', dropna=False)
    
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
    
    for sku, sku_df in grouped:
        if pd.isna(sku) or str(sku).strip() == '':
            continue
        
        orders = len(sku_df)
        
        # Count statuses
        delivered = (sku_df['_status_upper'] == 'DELIVERED').sum()
        rto = (sku_df['_status_upper'].str.contains('RTO', na=False)).sum()
        ndr = sku_df['ndr_flag'].sum() if 'ndr_flag' in sku_df.columns else 0
        cancelled = (sku_df['_status_upper'].isin(['CANCELED', 'CANCELLED', 'CANCEL'])).sum()
        in_transit_mask = (
            sku_df['_status_upper'].str.contains('IN TRANSIT', na=False) |
            sku_df['_status_upper'].str.contains('PICKED UP', na=False) |
            (sku_df['_status_upper'] == 'OFD') |
            (sku_df['_status_upper'] == 'OUT FOR DELIVERY')
        ) & (sku_df['_status_upper'] != 'DELIVERED')
        in_transit = in_transit_mask.sum()
        
        # GMV and margin - only for delivered orders
        delivered_df = sku_df[sku_df['_status_upper'] == 'DELIVERED']
        
        order_value_col = None
        for col in ['order_value', 'gmv_amount', 'order_total', 'order__total', 'total_order_value']:
            if col in delivered_df.columns:
                order_value_col = col
                break
        
        gmv = 0
        avg_order_value = 0
        if order_value_col:
            gmv = delivered_df[order_value_col].fillna(0).sum()
            avg_order_value = gmv / delivered if delivered > 0 else 0
        
        margin_col = None
        for col in ['margin', 'Margin', 'profit', 'Profit', 'profit_margin', 'margin_amount']:
            if col in delivered_df.columns:
                margin_col = col
                break
        
        margin = 0
        if margin_col:
            margin = delivered_df[margin_col].fillna(0).sum()
        
        # Get product name for this SKU (if available)
        product_name = 'Unknown'
        product_col = None
        for col in ['product_name', 'product__name']:
            if col in sku_df.columns:
                product_col = col
                break
        if product_col:
            product_values = sku_df[product_col].dropna().unique()
            if len(product_values) > 0:
                product_name = str(product_values[0])
        
        # Calculate percentages
        order_share = (orders / total_orders_all * 100) if total_orders_all > 0 else 0
        delivered_percent = (delivered / orders * 100) if orders > 0 else 0
        rto_percent = (rto / orders * 100) if orders > 0 else 0
        ndr_percent = (ndr / orders * 100) if orders > 0 else 0
        cancelled_percent = (cancelled / orders * 100) if orders > 0 else 0
        in_transit_percent = (in_transit / orders * 100) if orders > 0 else 0
        
        result.append({
            'sku': str(sku),
            'product_name': product_name,
            'orders': int(orders),
            'orderShare': float(order_share),
            'gmv': float(gmv),
            'avgOrderValue': float(avg_order_value),
            'margin': float(margin),
            'delivered': int(delivered),
            'deliveredPercent': float(delivered_percent),
            'rto': int(rto),
            'rtoPercent': float(rto_percent),
            'ndr': int(ndr),
            'ndrPercent': float(ndr_percent),
            'cancelled': int(cancelled),
            'cancelledPercent': float(cancelled_percent),
            'inTransit': int(in_transit),
            'inTransitPercent': float(in_transit_percent),
        })
    
    # Clean up
    df.drop(['_sku', '_status_upper'], axis=1, errors='ignore', inplace=True)
    
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


def compute_summary_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute summary metrics analytics"""
    if df.empty:
        return {
            'total_orders': 0,
            'total_delivered': 0,
            'total_ndr': 0,
            'total_rto': 0,
            'total_gmv': 0,
            'delivery_rate': 0,
            'ndr_rate': 0,
            'rto_rate': 0,
        }
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return {'total_orders': len(df), 'error': 'Status column not found'}
    
    df['_status_upper'] = df[status_col].astype(str).str.upper().str.strip()
    
    total_orders = len(df)
    total_delivered = (df['_status_upper'] == 'DELIVERED').sum()
    total_ndr = df['ndr_flag'].sum() if 'ndr_flag' in df.columns else 0
    total_rto = (df['_status_upper'].str.contains('RTO', na=False)).sum()
    
    # GMV
    order_value_col = None
    for col in ['order_value', 'gmv_amount', 'order_total', 'order__total', 'total_order_value']:
        if col in df.columns:
            order_value_col = col
            break
    
    total_gmv = 0
    if order_value_col:
        delivered_df = df[df['_status_upper'] == 'DELIVERED']
        total_gmv = delivered_df[order_value_col].fillna(0).sum()
    
    # Calculate rates
    delivery_rate = (total_delivered / total_orders * 100) if total_orders > 0 else 0
    ndr_rate = (total_ndr / total_orders * 100) if total_orders > 0 else 0
    rto_rate = (total_rto / total_orders * 100) if total_orders > 0 else 0
    
    # Calculate in-transit orders
    in_transit_statuses = ['IN TRANSIT', 'IN TRANSIT-AT DESTINATION HUB', 'PICKED UP', 
                          'REACHED DESTINATION HUB', 'OUT FOR DELIVERY', 'OFD']
    total_in_transit = df['_status_upper'].isin(in_transit_statuses).sum()
    in_transit_percent = (total_in_transit / total_orders * 100) if total_orders > 0 else 0
    
    # Calculate undelivered orders
    undelivered = total_orders - total_delivered
    
    df.drop('_status_upper', axis=1, errors='ignore', inplace=True)
    
    # Return format matching frontend expectations
    return {
        'syncedOrders': int(total_orders),
        'total_orders': int(total_orders),
        'total_delivered': int(total_delivered),
        'deliveredOrders': int(total_delivered),
        'total_ndr': int(total_ndr),
        'total_rto': int(total_rto),
        'rtoOrders': int(total_rto),
        'total_gmv': float(total_gmv),
        'gmv': float(total_gmv),
        'delivery_rate': float(delivery_rate),
        'deliveryPercent': float(delivery_rate),
        'ndr_rate': float(ndr_rate),
        'rto_rate': float(rto_rate),
        'rtoPercent': float(rto_rate),
        'inTransitOrders': int(total_in_transit),
        'inTransitPercent': float(in_transit_percent),
        'undeliveredOrders': int(undelivered),
    }


def compute_order_statuses(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute order statuses distribution"""
    if df.empty:
        return []
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    df['_status'] = df[status_col].fillna('Unknown').astype(str)
    status_counts = df['_status'].value_counts().to_dict()
    
    total = len(df)
    result = []
    for status, count in status_counts.items():
        percentage = (count / total * 100) if total > 0 else 0
        result.append({
            'status': str(status),
            'count': int(count),
            'percentage': float(percentage),
        })
    
    df.drop('_status', axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: x['count'], reverse=True)
    return result


def compute_payment_method_outcome(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute payment method outcome analytics"""
    if df.empty:
        return []
    
    # Get payment method column
    payment_col = None
    for col in ['payment_method', 'payment__method', 'paymentmethod']:
        if col in df.columns:
            payment_col = col
            break
    
    if not payment_col:
        return []
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    df['_payment'] = df[payment_col].fillna('Unknown').astype(str)
    df['_status_upper'] = df[status_col].astype(str).str.upper().str.strip()
    
    # Group by payment method and status
    grouped = df.groupby(['_payment', '_status_upper'])
    
    result = []
    payment_totals = df.groupby('_payment').size().to_dict()
    
    for (payment, status), group_df in grouped:
        count = len(group_df)
        payment_total = payment_totals.get(payment, 1)
        percentage = (count / payment_total * 100) if payment_total > 0 else 0
        
        result.append({
            'payment_method': str(payment),
            'status': str(status),
            'count': int(count),
            'percentage': float(percentage),
        })
    
    df.drop(['_payment', '_status_upper'], axis=1, errors='ignore', inplace=True)
    
    result.sort(key=lambda x: (x['payment_method'], x['count']), reverse=True)
    return result


def compute_ndr_count(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute NDR count by reason and time period"""
    if df.empty:
        return []
    
    # Filter only NDR records
    ndr_df = df[df['ndr_flag'] == True].copy()
    
    if ndr_df.empty:
        return []
    
    # Get NDR reason column
    ndr_reason_col = None
    for col in ['latest__n_d_r__reason', 'latest_ndr_reason', 'ndr_reason', 'Latest NDR Reason', 'NDR Reason']:
        if col in ndr_df.columns:
            ndr_reason_col = col
            break
    
    if not ndr_reason_col:
        ndr_reason_col = 'ndr_reason'
        ndr_df[ndr_reason_col] = 'Unknown Exception'
    
    # Get order date column for time grouping
    order_date_col = None
    for col in ['order_date', 'order__date', 'shiprocket__created__at', 'Shiprocket Created At']:
        if col in ndr_df.columns:
            order_date_col = col
            break
    
    # Group by reason
    result = []
    for reason, reason_df in ndr_df.groupby(ndr_reason_col, dropna=False):
        reason_str = str(reason) if not pd.isna(reason) else 'Unknown Exception'
        
        # Count delivered after NDR
        status_col = None
        for col in ['original_status', 'status', 'delivery_status']:
            if col in reason_df.columns:
                status_col = col
                break
        
        delivered = 0
        if status_col:
            delivered = (reason_df[status_col].astype(str).str.upper().str.strip() == 'DELIVERED').sum()
        
        total = len(reason_df)
        
        result.append({
            'reason': reason_str,
            'delivered': int(delivered),
            'total': int(total),
        })
    
    # Sort by total (descending)
    result.sort(key=lambda x: x['total'], reverse=True)
    return result


def compute_address_type_share(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute address type share analytics"""
    if df.empty:
        return []
    
    # Get address quality column
    address_col = None
    for col in ['address_quality', 'Address Quality', 'address__quality']:
        if col in df.columns:
            address_col = col
            break
    
    if not address_col:
        # Default all to GOOD if column doesn't exist
        result = [
            {'addressType': 'Good Address %', 'percent': 100.0},
            {'addressType': 'Invalid Address%', 'percent': 0.0},
            {'addressType': 'Short Address %', 'percent': 0.0},
        ]
        return result
    
    # Count by address type
    total = len(df)
    address_counts = df[address_col].value_counts().to_dict()
    
    # Map to display names
    type_mapping = {
        'INVALID': 'Invalid Address%',
        'SHORT': 'Short Address %',
        'GOOD': 'Good Address %',
    }
    
    result = []
    for addr_type, count in address_counts.items():
        addr_type_str = str(addr_type).upper()
        display_name = type_mapping.get(addr_type_str, 'Good Address %')
        percent = (count / total * 100) if total > 0 else 0.0
        result.append({
            'addressType': display_name,
            'percent': float(percent),
        })
    
    # Ensure all types are present
    existing_types = {r['addressType'] for r in result}
    for display_name in ['Invalid Address%', 'Short Address %', 'Good Address %']:
        if display_name not in existing_types:
            result.append({'addressType': display_name, 'percent': 0.0})
    
    return result


def compute_average_order_tat(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute average order TAT (Turnaround Time) analytics"""
    if df.empty:
        return []
    
    def parse_date_from_record(record, col_names):
        """Helper to parse date from various column names"""
        for col in col_names:
            if col in record and pd.notna(record[col]):
                try:
                    return pd.to_datetime(record[col])
                except:
                    continue
        return None
    
    def convert_tat_to_days(hours):
        """Convert hours to days"""
        if pd.isna(hours) or hours is None:
            return None
        return hours / 24.0
    
    metrics = {
        'Order Placed to Pickup TAT': [],
        'Order Placed - Approval TAT': [],
        'Approval to AWB TAT': [],
        'AWB to Pickup TAT': [],
        'Pickup OFD TAT': [],
        'Order Placed to OFD TAT': [],
    }
    
    for _, record in df.iterrows():
        # Parse dates
        order_date = parse_date_from_record(record, [
            'Shiprocket Created At', 'shiprocket__created__at', 'order_date', 'order__date', 'Order Date'
        ])
        
        approval_date = parse_date_from_record(record, [
            'Approval Date', 'approval__date', 'Order Approved Date', 'order__approved__date'
        ]) or order_date  # Default to order_date if not found
        
        awb_date = parse_date_from_record(record, [
            'AWB Assigned Date', 'awb_assigned_date', 'awb__assigned__date'
        ])
        
        pickup_date = parse_date_from_record(record, [
            'Order Picked Up Date', 'order__picked__up__date', 'Pickedup Timestamp', 'pickup_date'
        ])
        
        ofd_date = parse_date_from_record(record, [
            'First Out For Delivery Date', 'first__out__for__delivery__date', 'Latest OFD Date', 'latest__o_f_d__date'
        ])
        
        # Calculate TATs
        if order_date and pickup_date:
            tat = convert_tat_to_days((pickup_date - order_date).total_seconds() / 3600)
            if tat is not None:
                metrics['Order Placed to Pickup TAT'].append(tat)
        
        if order_date and approval_date:
            tat = convert_tat_to_days((approval_date - order_date).total_seconds() / 3600)
            if tat is not None:
                metrics['Order Placed - Approval TAT'].append(tat)
        
        if approval_date and awb_date:
            tat = convert_tat_to_days((awb_date - approval_date).total_seconds() / 3600)
            if tat is not None:
                metrics['Approval to AWB TAT'].append(tat)
        
        if awb_date and pickup_date:
            tat = convert_tat_to_days((pickup_date - awb_date).total_seconds() / 3600)
            if tat is not None:
                metrics['AWB to Pickup TAT'].append(tat)
        
        if pickup_date and ofd_date:
            tat = convert_tat_to_days((ofd_date - pickup_date).total_seconds() / 3600)
            if tat is not None:
                metrics['Pickup OFD TAT'].append(tat)
        
        if order_date and ofd_date:
            tat = convert_tat_to_days((ofd_date - order_date).total_seconds() / 3600)
            if tat is not None:
                metrics['Order Placed to OFD TAT'].append(tat)
    
    # Calculate averages
    result = []
    for metric_name, values in metrics.items():
        avg = np.mean(values) if values else None
        result.append({
            'metric': metric_name,
            'average': float(avg) if avg is not None else None,
            'count': len(values),
        })
    
    # Add approved orders count
    approved_count = len(df)
    result.append({
        'metric': 'Approved Orders',
        'average': None,
        'count': int(approved_count),
    })
    
    return result


def compute_fad_del_can_rto(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute FAD/DEL/CAN/RTO % analytics"""
    if df.empty:
        return []
    
    total = len(df)
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    # Initialize counts
    metrics = {
        'FAD%': 0,
        'Del%': 0,
        'OFD%': 0,
        'NDR%': 0,
        'Intransit%': 0,
        'RTO%': 0,
        'Canceled%': 0,
        'RVP%': 0,
    }
    
    # Check for flags
    ndr_flag_col = 'ndr_flag' if 'ndr_flag' in df.columns else None
    cancelled_flag_col = 'cancelled_flag' if 'cancelled_flag' in df.columns else None
    
    for _, record in df.iterrows():
        status = str(record[status_col]).upper().strip() if pd.notna(record[status_col]) else ''
        
        # Check flags
        is_ndr = False
        if ndr_flag_col and pd.notna(record.get(ndr_flag_col)):
            is_ndr = bool(record[ndr_flag_col])
        
        is_cancelled = False
        if cancelled_flag_col and pd.notna(record.get(cancelled_flag_col)):
            is_cancelled = bool(record[cancelled_flag_col])
        
        # Categorize
        is_delivered = status in ['DELIVERED', 'DEL']
        is_fad = is_delivered and not is_ndr
        is_ofd = status in ['OFD', 'OUT FOR DELIVERY']
        is_ndr_status = is_ndr or status == 'NDR' or 'NDR' in status
        is_rto = status in ['RTO', 'RTO DELIVERED', 'RTO INITIATED', 'RTO IN TRANSIT', 'RTO NDR'] or 'RTO' in status
        is_canceled = is_cancelled or status in ['CANCELED', 'CANCELLED', 'CANCEL'] or 'CANCEL' in status
        is_rvp = 'RVP' in status
        is_in_transit = (
            'IN TRANSIT' in status or 'PICKED UP' in status or 
            'REACHED DESTINATION' in status or 'AT DESTINATION' in status
        ) and not is_delivered and not is_rto and not is_canceled
        
        if is_fad:
            metrics['FAD%'] += 1
        if is_delivered:
            metrics['Del%'] += 1
        if is_ofd:
            metrics['OFD%'] += 1
        if is_ndr_status:
            metrics['NDR%'] += 1
        if is_in_transit:
            metrics['Intransit%'] += 1
        if is_rto:
            metrics['RTO%'] += 1
        if is_canceled:
            metrics['Canceled%'] += 1
        if is_rvp:
            metrics['RVP%'] += 1
    
    # Convert to percentages
    result = []
    for metric_name, count in metrics.items():
        percent = (count / total * 100) if total > 0 else 0.0
        result.append({
            'metric': metric_name,
            'percent': float(percent),
        })
    
    return result


def compute_cancellation_reason_tracker(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute cancellation reason tracker analytics"""
    if df.empty:
        return []
    
    # Get cancellation reason column
    cancellation_col = None
    for col in ['cancellation__reason', 'cancellation_reason', 'Cancellation Reason', 'Cancellation_Bucket']:
        if col in df.columns:
            cancellation_col = col
            break
    
    # Check for cancelled flag
    cancelled_flag_col = 'cancelled_flag' if 'cancelled_flag' in df.columns else None
    
    total = len(df)
    
    # Count by reason
    if cancellation_col:
        reason_counts = df[cancellation_col].value_counts().to_dict()
    else:
        reason_counts = {}
    
    # Count cancelled vs not cancelled
    if cancelled_flag_col:
        cancelled_count = df[cancelled_flag_col].sum() if cancelled_flag_col in df.columns else 0
        not_cancelled_count = total - cancelled_count
        
        if not_cancelled_count > 0:
            reason_counts['Not Canceled'] = not_cancelled_count
    else:
        # If no flag, check status column
        status_col = None
        for col in ['original_status', 'status', 'delivery_status']:
            if col in df.columns:
                status_col = col
                break
        
        if status_col:
            cancelled_statuses = ['CANCELED', 'CANCELLED', 'CANCEL']
            cancelled_mask = df[status_col].astype(str).str.upper().str.strip().isin(cancelled_statuses)
            cancelled_count = cancelled_mask.sum()
            not_cancelled_count = total - cancelled_count
            
            if not_cancelled_count > 0:
                reason_counts['Not Canceled'] = not_cancelled_count
    
    # Convert to result format
    result = []
    for reason, count in reason_counts.items():
        reason_str = str(reason) if not pd.isna(reason) else 'Not Canceled'
        percent = (count / total * 100) if total > 0 else 0.0
        result.append({
            'reason': reason_str,
            'percent': float(percent),
        })
    
    # Sort: "Not Canceled" first, then others
    result.sort(key=lambda x: (x['reason'] != 'Not Canceled', x['reason']))
    
    return result


def compute_delivery_partner_analysis(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Compute delivery partner analysis by state and courier"""
    if df.empty:
        return []
    
    # Get state and courier columns
    state_col = None
    for col in ['state', 'address__state', 'Address State']:
        if col in df.columns:
            state_col = col
            break
    
    courier_col = None
    for col in ['Courier Company', 'courier_company', 'courier__company', 'Master Courier', 'master_courier']:
        if col in df.columns:
            courier_col = col
            break
    
    if not state_col or not courier_col:
        return []
    
    # Get status column
    status_col = None
    for col in ['original_status', 'status', 'delivery_status']:
        if col in df.columns:
            status_col = col
            break
    
    if not status_col:
        return []
    
    # Group by state and courier
    result = []
    for (state, courier), group_df in df.groupby([state_col, courier_col], dropna=False):
        state_str = str(state) if not pd.isna(state) else 'Unknown'
        courier_str = str(courier) if not pd.isna(courier) else 'Unknown'
        
        total_orders = len(group_df)
        
        # Count by status
        status_upper = group_df[status_col].astype(str).str.upper().str.strip()
        
        delivered = (status_upper == 'DELIVERED').sum()
        cancelled = (status_upper.isin(['CANCELED', 'CANCELLED', 'CANCEL'])).sum()
        rto = (status_upper.str.contains('RTO', na=False)).sum()
        
        in_transit = (
            status_upper.str.contains('IN TRANSIT', na=False) |
            status_upper.str.contains('PICKED UP', na=False) |
            status_upper.str.contains('REACHED DESTINATION', na=False) |
            status_upper.str.contains('AT DESTINATION', na=False) |
            (status_upper == 'OFD') |
            (status_upper == 'OUT FOR DELIVERY')
        ) & (status_upper != 'DELIVERED') & (~status_upper.str.contains('RTO', na=False)) & (~status_upper.isin(['CANCELED', 'CANCELLED', 'CANCEL']))
        
        in_transit_count = in_transit.sum()
        other = total_orders - delivered - cancelled - rto - in_transit_count
        
        result.append({
            'state': state_str,
            'courier': courier_str,
            'total_orders': int(total_orders),
            'delivered': int(delivered),
            'cancelled': int(cancelled),
            'in_transit': int(in_transit_count),
            'rto': int(rto),
            'other': int(other),
        })
    
    # Sort by total_orders (descending)
    result.sort(key=lambda x: x['total_orders'], reverse=True)
    
    return result


def compute_single_analytics(
    data: List[Dict[str, Any]],
    analytics_type: str, 
    filters: Optional[Dict[str, Any]] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    Compute a single analytics type on-demand
    
    Args:
        data: List of shipping data dictionaries
        analytics_type: Type of analytics to compute
        filters: Optional dictionary of filter parameters
    
    Returns:
        Analytics data or None if analytics type is not supported
    """
    # Map analytics types to their compute functions
    analytics_functions = {
        'weekly-summary': compute_weekly_summary,
        'ndr-weekly': compute_ndr_weekly,
        'state-performance': compute_state_performance,
        'category-share': compute_category_share,
        'cancellation-tracker': compute_cancellation_tracker,
        'channel-share': compute_channel_share,
        'payment-method': compute_payment_method,
        'product-analysis': compute_product_analysis,
        'sku-analysis': compute_sku_analysis,
        'summary-metrics': compute_summary_metrics,
        'order-statuses': compute_order_statuses,
        'payment-method-outcome': compute_payment_method_outcome,
        'ndr-count': compute_ndr_count,
        'address-type-share': compute_address_type_share,
        'average-order-tat': compute_average_order_tat,
        'fad-del-can-rto': compute_fad_del_can_rto,
        'cancellation-reason-tracker': compute_cancellation_reason_tracker,
        'delivery-partner-analysis': compute_delivery_partner_analysis,
    }
    
    # Check if analytics type is supported
    if analytics_type not in analytics_functions:
        print(f"Warning: Analytics type '{analytics_type}' is not supported")
        return None
    
    try:
        if data is None or len(data) == 0:
            print(f"❌ No data provided or empty data list")
            return None if analytics_type != 'summary-metrics' else {}
        
        print(f"✅ Processing {len(data)} records")
        
        # Convert to DataFrame
        try:
            df = pd.DataFrame(data)
            print(f"✅ Converted to DataFrame: {df.shape[0]} rows, {df.shape[1]} columns")
        except Exception as e:
            print(f"❌ Error converting data to DataFrame: {e}")
            print(f"   First record type: {type(data[0]) if data else 'N/A'}")
            print(f"   First record keys: {list(data[0].keys()) if data and isinstance(data[0], dict) else 'N/A'}")
            raise
        
        # Apply filters if provided
        if filters:
            print(f"🔍 Applying filters: {filters}")
            df_before = len(df)
            df = filter_shipping_data(df, filters)
            df_after = len(df)
            print(f"✅ Filtered data: {df_before} -> {df_after} rows")
        
        if df.empty:
            print(f"⚠️  DataFrame is empty after filtering")
            return [] if analytics_type != 'summary-metrics' else {}
        
        # Compute the specific analytics type
        print(f"🔍 Computing '{analytics_type}' analytics...")
        compute_func = analytics_functions[analytics_type]
        result = compute_func(df.copy())
        
        if result is None:
            print(f"⚠️  Compute function returned None for '{analytics_type}'")
            return None
        
        print(f"✅ Computed '{analytics_type}': {len(result) if isinstance(result, list) else 'dict'} items")
        return result
    
    except Exception as e:
        import traceback
        print(f'❌ Error computing {analytics_type} analytics: {e}')
        print(traceback.format_exc())
        return None


def compute_all_analytics(data: List[Dict[str, Any]], filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Compute all analytics from provided data
    
    Args:
        data: List of shipping data dictionaries
        filters: Optional dictionary of filter parameters. Must be None or a dict.
    
    Returns:
        {'success': bool, 'error': str (if failed)}
    """
    # Safety check: ensure filters is None or a dictionary
    if filters is not None and not isinstance(filters, dict):
        print(f"Warning: filters must be None or dict, got {type(filters)}. Setting to None.")
        filters = None
    try:
        if data is None or len(data) == 0:
            error_msg = 'No data provided or empty data list'
            print(f"❌ [compute_all_analytics] {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
        
        print(f"✅ [compute_all_analytics] Processing {len(data)} records")
        
        # Convert to DataFrame
        try:
            df = pd.DataFrame(data)
            print(f"✅ [compute_all_analytics] Converted to DataFrame: {df.shape[0]} rows, {df.shape[1]} columns")
        except Exception as e:
            print(f"❌ [compute_all_analytics] Error converting data to DataFrame: {e}")
            print(f"   First record type: {type(data[0]) if data else 'N/A'}")
            print(f"   First record keys: {list(data[0].keys()) if data and isinstance(data[0], dict) else 'N/A'}")
            raise
        
        # Apply filters if provided
        if filters:
            df = filter_shipping_data(df, filters)
        
        if df.empty:
            return {'success': True, 'message': 'Data is empty after filtering'}
        
        # Compute all analytics
        analytics_types = [
            'weekly-summary', 'ndr-weekly', 'state-performance',
            'category-share', 'cancellation-tracker', 'channel-share',
            'payment-method', 'product-analysis'
        ]
        
        # Compute all analytics
        for analytics_type in analytics_types:
            compute_func = {
                'weekly-summary': compute_weekly_summary,
                'ndr-weekly': compute_ndr_weekly,
                'state-performance': compute_state_performance,
                'category-share': compute_category_share,
                'cancellation-tracker': compute_cancellation_tracker,
                'channel-share': compute_channel_share,
                'payment-method': compute_payment_method,
                'product-analysis': compute_product_analysis,
            }[analytics_type]
            
            try:
                result = compute_func(df.copy())
                print(f"✅ Computed '{analytics_type}' analytics")
            except Exception as e:
                print(f"⚠️  Error computing '{analytics_type}': {e}")
        
        return {'success': True}
    
    except Exception as e:
        import traceback
        print(f'Error computing analytics: {e}')
        print(traceback.format_exc())
        return {
            'success': False,
            'error': str(e) or 'Failed to compute analytics'
        }
