"""
Data Preprocessing Utilities for Shipping Analytics
Functions to normalize and clean shipping data using pandas
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional
import re


def normalize_keys(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to snake_case"""
    def to_snake_case(name: str) -> str:
        # Strip whitespace first
        name = str(name).strip()
        # Convert to snake_case
        name = re.sub(r'(?<!^)(?=[A-Z])', '_', name)
        name = name.lower()
        name = re.sub(r'\s+', '_', name)
        name = re.sub(r'[^a-z0-9_]', '', name)
        return name
    
    df.columns = [to_snake_case(col) for col in df.columns]
    return df


def standardize_missing_values(value: Any) -> Any:
    """Standardize missing values (none, N/A, empty → None)"""
    if pd.isna(value) or value is None:
        return None
    
    if isinstance(value, str):
        str_val = value.strip().lower()
        if str_val in ['', 'none', 'n/a', 'na', 'null']:
            return None
    
    return value


def parse_date(date_str: Any) -> Optional[datetime]:
    """Convert date string to datetime"""
    if pd.isna(date_str) or date_str is None:
        return None
    
    standardized = standardize_missing_values(date_str)
    if not standardized:
        return None
    
    date_string = str(standardized).strip()
    
    # Handle "N/A" and similar
    if date_string.upper() == "N/A" or date_string == "'":
        return None
    
    try:
        # Try parsing MM/DD/YY or MM/DD/YYYY format
        mmddyy_pattern = r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$'
        match = re.match(mmddyy_pattern, date_string)
        
        if match:
            month = int(match.group(1)) - 1  # Python months are 0-indexed
            day = int(match.group(2))
            year = int(match.group(3))
            
            # Handle 2-digit years
            if year < 100:
                year = 2000 + year if year < 50 else 1900 + year
            
            try:
                date = datetime(year, month + 1, day)  # datetime uses 1-indexed months
                return date
            except ValueError:
                pass
        
        # Try pandas to_datetime
        date = pd.to_datetime(date_string, errors='coerce')
        if pd.notna(date):
            return date.to_pydatetime()
    except Exception:
        pass
    
    return None


def parse_number(value: Any) -> Optional[float]:
    """Convert to number"""
    if pd.isna(value) or value is None:
        return None
    
    standardized = standardize_missing_values(value)
    if not standardized:
        return None
    
    if isinstance(standardized, (int, float)):
        return float(standardized) if not np.isnan(standardized) else None
    
    # Remove non-numeric characters except decimal point and minus sign
    num_str = re.sub(r'[^0-9.-]', '', str(standardized))
    try:
        num = float(num_str)
        return num if not np.isnan(num) else None
    except (ValueError, TypeError):
        return None


def parse_boolean(value: Any) -> bool:
    """Convert to boolean"""
    if pd.isna(value) or value is None:
        return False
    
    str_val = str(value).strip().lower()
    return str_val in ['true', 'yes', '1', 'y']


def get_order_week(date: Optional[datetime]) -> Optional[str]:
    """
    Get order week from date (based on monthly date ranges: 1-7, 8-14, 15-21, 22-28, 29-31)
    Returns format: "YYYY-MM-DD-DD" (e.g., "2025-12-01-07" for Dec 1-7)
    """
    if date is None or pd.isna(date):
        return None
    
    year = date.year
    month = date.month
    day = date.day
    
    # Calculate which week of the month based on day ranges
    if 1 <= day <= 7:
        week_start, week_end = 1, 7
    elif 8 <= day <= 14:
        week_start, week_end = 8, 14
    elif 15 <= day <= 21:
        week_start, week_end = 15, 21
    elif 22 <= day <= 28:
        week_start, week_end = 22, 28
    else:
        # Days 29-31 (remaining days)
        week_start = 29
        # Get last day of the month
        if month == 12:
            last_day = 31
        elif month in [4, 6, 9, 11]:
            last_day = 30
        elif month == 2:
            last_day = 29 if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0) else 28
        else:
            last_day = 31
        week_end = last_day
    
    # Format as "YYYY-MM-DD-DD"
    month_str = str(month).zfill(2)
    start_str = str(week_start).zfill(2)
    end_str = str(week_end).zfill(2)
    
    return f"{year}-{month_str}-{start_str}-{end_str}"


def get_delivery_status(row: pd.Series, original_df: Optional[pd.DataFrame] = None) -> str:
    """Determine delivery status from row data"""
    def normalize_for_comparison(s: str) -> str:
        return re.sub(r'[\s\-_]', '', s).upper()
    
    # Check original Status field first
    status_field = (
        row.get('status') or
        row.get('original_status') or
        row.get('delivery_status') or
        row.get('current_status') or
        ''
    )
    status_str = str(status_field).upper().strip()
    
    # Explicit statuses that should be preserved
    explicit_statuses = [
        'CANCELED', 'CANCELLED', 'CANCEL',
        'DESTROYED', 'LOST', 'UNTRACEABLE',
        'PICKUP EXCEPTION',
        'REACHED BACK AT_SELLER_CITY',
        'REACHED DESTINATION HUB',
        'RTO DELIVERED', 'RTO IN TRANSIT', 'RTO INITIATED', 'RTO NDR',
        'UNDELIVERED-1ST ATTEMPT', 'UNDELIVERED-2ND ATTEMPT', 'UNDELIVERED-3RD ATTEMPT',
        'UNDELIVERED-1ST-ATTEMPT', 'UNDELIVERED-2ND-ATTEMPT', 'UNDELIVERED-3RD-ATTEMPT',
        'OUT FOR DELIVERY', 'OUT FOR PICKUP', 'PICKED UP',
        'IN TRANSIT', 'IN TRANSIT-AT DESTINATION HUB'
    ]
    
    # Check if status matches any explicit status
    normalized_status = normalize_for_comparison(status_str)
    for explicit_status in explicit_statuses:
        normalized_explicit = normalize_for_comparison(explicit_status)
        if (status_str == explicit_status or
            normalized_status == normalized_explicit or
            normalized_status in normalized_explicit or
            normalized_explicit in normalized_status):
            # Normalize RTO statuses
            if 'RTODELIVERED' in normalized_status:
                return 'RTO DELIVERED'
            if 'RTOINITIATED' in normalized_status:
                return 'RTO INITIATED'
            if 'RTOINTRANSIT' in normalized_status:
                return 'RTO IN TRANSIT'
            if 'RTONDR' in normalized_status:
                return 'RTO NDR'
            return status_str
    
    # Check if delivered date exists
    delivered_date = (
        row.get('order_delivered_date') or
        row.get('delivery_date') or
        row.get('delivered_date')
    )
    if delivered_date and str(delivered_date).upper() not in ['N/A', "'", 'NONE', 'NAN']:
        return 'DELIVERED'
    
    # Check NDR fields
    ndr_date = (
        row.get('latest_n_d_r__date') or
        row.get('ndr_date')
    )
    if ndr_date and str(ndr_date).upper() not in ['N/A', "'", 'NONE', 'NAN']:
        return 'NDR'
    
    # Check RTO fields
    normalized_status_for_rto = normalize_for_comparison(status_str)
    has_rto_status = any([
        'RTODELIVERED' in normalized_status_for_rto,
        'RTOINITIATED' in normalized_status_for_rto,
        'RTOINTRANSIT' in normalized_status_for_rto,
        'RTONDR' in normalized_status_for_rto
    ])
    
    if not has_rto_status:
        rto_date = (
            row.get('r_t_o__initiated__date') or
            row.get('rto_date')
        )
        if rto_date and str(rto_date).upper() not in ['N/A', "'", 'NONE', 'NAN']:
            rto_delivered_date = (
                row.get('r_t_o__delivered__date') or
                row.get('rto_delivered_date')
            )
            if rto_delivered_date and str(rto_delivered_date).upper() not in ['N/A', "'", 'NONE', 'NAN']:
                return 'RTO DELIVERED'
            return 'RTO INITIATED'
    
    # Check OFD (Out For Delivery)
    ofd_date = (
        row.get('first_out_for_delivery_date') or
        row.get('latest_o_f_d__date')
    )
    if ofd_date and str(ofd_date).upper() not in ['N/A', "'", 'NONE', 'NAN']:
        return 'OFD'
    
    # Return status if valid
    if status_str and status_str not in ['N/A', 'NONE', 'NULL', '']:
        return status_str
    
    return 'PENDING'


def get_address_quality(row: pd.Series) -> str:
    """Determine address quality"""
    address_line1 = str(row.get('address_line_1', '') or '')
    address_line2 = str(row.get('address_line_2', '') or '')
    city = str(row.get('city', '') or row.get('address_city', '') or '')
    state = str(row.get('state', '') or row.get('address_state', '') or '')
    pincode = str(row.get('pincode', '') or row.get('address_pincode', '') or '')
    
    full_address = f"{address_line1} {address_line2} {city} {state} {pincode}".strip()
    
    if not address_line1 or address_line1.lower() in ['none', 'n/a'] or len(full_address) < 10:
        return 'INVALID'
    
    if (not city or not state or not pincode or
        city.lower() in ['none', 'n/a'] or
        state.lower() in ['none', 'n/a'] or
        pincode.lower() in ['none', 'n/a']):
        return 'SHORT'
    
    if len(full_address) < 30:
        return 'SHORT'
    
    return 'GOOD'


def calculate_tat(start_date: Optional[datetime], end_date: Optional[datetime]) -> Optional[float]:
    """Calculate TAT in hours between two dates"""
    if start_date is None or end_date is None or pd.isna(start_date) or pd.isna(end_date):
        return None
    
    try:
        diff = (end_date - start_date).total_seconds() / 3600
        return diff if diff >= 0 else None
    except Exception:
        return None


def preprocess_shipping_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Main preprocessing function using pandas
    Converts raw shipping data DataFrame into normalized format
    """
    # Create a copy to avoid modifying original
    df = df.copy()
    
    # Store original column names mapping for status field lookup
    original_columns = df.columns.tolist()
    
    # Normalize column names
    df = normalize_keys(df)
    
    # Standardize missing values
    for col in df.columns:
        df[col] = df[col].apply(standardize_missing_values)
    
    # Date field mappings - updated to match CSV column structure
    # Note: After normalization, "Shiprocket Created At" becomes "shiprocket__created__at" (double underscores)
    date_fields = {
        'order_date': ['shiprocket__created__at', 'shiprocket_created_at', 'channel__created__at', 'channel_created_at', 'order_date', 'order_placed_date', 'created_at'],
        'pickup_date': ['order__picked__up__date', 'order_picked_up_date', 'pickedup__timestamp', 'pickedup_timestamp', 'pickup_date', 'pickup_datetime', 'pickup__first__attempt__date', 'pickup_first_attempt_date'],
        'ofd_date': ['first__out__for__delivery__date', 'first_out_for_delivery_date', 'latest__o_f_d__date', 'latest_o_f_d__date', 'latest_ofd_date', 'ofd_date', 'ofd_datetime', 'out_for_delivery_date'],
        'delivery_date': ['order__delivered__date', 'order_delivered_date', 'delivery_date', 'delivered_date', 'delivered_datetime'],
        'ndr_date': ['latest__n_d_r__date', 'latest_n_d_r__date', 'latest_ndr_date', 'n_d_r_1__attempt__date', 'ndr_1_attempt_date', 'ndr_2_attempt_date', 'ndr_3_attempt_date', 'ndr_date', 'ndr_datetime'],
        'rto_date': ['r_t_o__initiated__date', 'r_t_o__delivered__date', 'rto_initiated_date', 'rto_delivered_date', 'rto_date', 'rto_datetime'],
    }
    
    # Parse dates - batch all operations to avoid fragmentation
    parsed_dates = {}
    parsed_date_cols = {}  # Store parsed datetime columns
    date_string_cols = {}
    for target_field, source_fields in date_fields.items():
        for source_field in source_fields:
            if source_field in df.columns:
                # Parse dates and store temporarily
                parsed_col = df[source_field].apply(parse_date)
                if parsed_col.notna().any():
                    parsed_dates[target_field] = source_field + '_parsed'
                    parsed_date_cols[source_field + '_parsed'] = parsed_col
                    # Collect ISO date strings to add in batch
                    date_string_cols[target_field] = parsed_col.apply(
                        lambda x: x.strftime('%Y-%m-%d') if pd.notna(x) and x is not None else None
                    )
                    break
    
    # Add all parsed date columns at once to avoid fragmentation
    if parsed_date_cols:
        parsed_date_df = pd.DataFrame(parsed_date_cols, index=df.index)
        df = pd.concat([df, parsed_date_df], axis=1)
    
    # Add all date string columns at once
    if date_string_cols:
        date_df = pd.DataFrame(date_string_cols, index=df.index)
        df = pd.concat([df, date_df], axis=1)
    
    # Number field mappings
    number_fields = {
        'order_value': ['order_total', 'order_value', 'price', 'amount', 'gmv_amount', 'total_order_value'],
        'order_price': ['product_price'],
        'weight': ['weight_k_g', 'weight'],
        'order_risk_score': ['order_risk', 'address_score'],
    }
    
    # Parse numbers
    for target_field, source_fields in number_fields.items():
        for source_field in source_fields:
            if source_field in df.columns:
                df[target_field] = df[source_field].apply(parse_number)
                if df[target_field].notna().any():
                    break
    
    # Parse booleans
    # Note: Updating existing columns is less problematic than adding new ones
    boolean_fields = ['ndr', 'rto', 'cancelled', 'canceled', 'address_verified', 'is_verified']
    for field in boolean_fields:
        if field in df.columns:
            df[field] = df[field].apply(parse_boolean)
    
    # Batch field mappings to avoid fragmentation
    field_mappings = {}
    
    # Map category field
    category_fields = ['product_category', 'category']
    category_mapped = False
    for field in category_fields:
        if field in df.columns:
            field_mappings['category'] = df[field]
            category_mapped = True
            break
    if not category_mapped or ('category' in df.columns and df['category'].isna().all()):
        field_mappings['category'] = 'Uncategorized'
    
    # Map channel field
    channel_fields = ['channel', 'channel__']
    channel_mapped = False
    for field in channel_fields:
        if field in df.columns:
            field_mappings['channel'] = df[field]
            channel_mapped = True
            break
    if not channel_mapped:
        field_mappings['channel'] = None
    
    # Map state field
    state_fields = ['address_state', 'state']
    for field in state_fields:
        if field in df.columns:
            field_mappings['state'] = df[field]
            break
    
    # Map address fields (for address quality calculation)
    address_line1_fields = ['address_line_1', 'address_line1']
    for field in address_line1_fields:
        if field in df.columns:
            field_mappings['address_line_1'] = df[field]
            break
    
    address_line2_fields = ['address_line_2', 'address_line2']
    for field in address_line2_fields:
        if field in df.columns:
            field_mappings['address_line_2'] = df[field]
            break
    
    city_fields = ['address_city', 'city']
    for field in city_fields:
        if field in df.columns:
            field_mappings['city'] = df[field]
            break
    
    pincode_fields = ['address_pincode', 'pincode']
    for field in pincode_fields:
        if field in df.columns:
            field_mappings['pincode'] = df[field]
            break
    
    # Map SKU
    sku_fields = ['master_s_k_u', 'channel_s_k_u', 'sku']
    for field in sku_fields:
        if field in df.columns:
            field_mappings['sku'] = df[field]
            break
    
    # Map product name
    product_name_fields = ['product_name', 'product__name']
    for field in product_name_fields:
        if field in df.columns:
            field_mappings['product_name'] = df[field]
            break
    
    # Map payment method
    payment_method_fields = ['payment_method', 'payment__method']
    for field in payment_method_fields:
        if field in df.columns:
            field_mappings['payment_method'] = df[field]
            break
    
    # Preserve original status
    if 'status' in df.columns:
        field_mappings['original_status'] = df['status']
    
    # Add all field mappings at once
    if field_mappings:
        mapping_df = pd.DataFrame(field_mappings, index=df.index)
        df = pd.concat([df, mapping_df], axis=1)
    
    # Clean up category field (needs to be done after adding to df)
    if 'category' in df.columns:
        df['category'] = df['category'].fillna('Uncategorized')
        df.loc[df['category'].isin(['none', 'N/A', '', None]), 'category'] = 'Uncategorized'
    
    # Batch derived fields to avoid fragmentation
    derived_fields = {}
    
    # Order week
    order_date_col = parsed_dates.get('order_date')
    if order_date_col:
        derived_fields['order_week'] = df[order_date_col].apply(get_order_week)
    else:
        derived_fields['order_week'] = None
    
    # Status upper (needed for cancelled_flag)
    status_col = df.get('status', pd.Series(dtype=str, index=df.index))
    derived_fields['status_upper'] = status_col.astype(str).str.upper()
    
    # Add order_week and status_upper first since cancelled_flag depends on status_upper
    if derived_fields:
        first_batch = {k: derived_fields.pop(k) for k in ['order_week', 'status_upper'] if k in derived_fields}
        if first_batch:
            first_df = pd.DataFrame(first_batch, index=df.index)
            df = pd.concat([df, first_df], axis=1)
    
    # NDR flag
    ndr_date_col = parsed_dates.get('ndr_date')
    if ndr_date_col:
        derived_fields['ndr_flag'] = df[ndr_date_col].notna()
    else:
        derived_fields['ndr_flag'] = False
    
    # RTO flag
    rto_date_col = parsed_dates.get('rto_date')
    if rto_date_col:
        derived_fields['rto_flag'] = df[rto_date_col].notna()
    else:
        derived_fields['rto_flag'] = False
    
    # Cancelled flag (depends on status_upper which is now in df)
    cancellation_reason_fields = ['cancellation_reason', 'cancellation__reason']
    has_cancellation = False
    for field in cancellation_reason_fields:
        if field in df.columns:
            derived_fields['cancelled_flag'] = (
                df['status_upper'].str.contains('CANCEL', na=False) |
                (df[field].notna() & ~df[field].isin(['none', 'N/A', None, '']))
            )
            has_cancellation = True
            break
    if not has_cancellation:
        derived_fields['cancelled_flag'] = df['status_upper'].str.contains('CANCEL', na=False)
    
    # Delivery status
    derived_fields['delivery_status'] = df.apply(get_delivery_status, axis=1)
    
    # Address quality
    derived_fields['address_quality'] = df.apply(get_address_quality, axis=1)
    
    # Add all derived fields at once
    if derived_fields:
        derived_df = pd.DataFrame(derived_fields, index=df.index)
        df = pd.concat([df, derived_df], axis=1)
    
    # Calculate TAT metrics and collect new columns to avoid DataFrame fragmentation
    order_date_dt = parsed_dates.get('order_date')
    pickup_date_dt = parsed_dates.get('pickup_date')
    ofd_date_dt = parsed_dates.get('ofd_date')
    delivery_date_dt = parsed_dates.get('delivery_date')
    
    # Collect all new columns in a dictionary to add at once
    new_columns = {}
    
    # Calculate TAT metrics
    if order_date_dt and pickup_date_dt:
        new_columns['order_to_pickup_tat'] = df.apply(
            lambda row: calculate_tat(
                row.get(order_date_dt),
                row.get(pickup_date_dt)
            ), axis=1
        )
    else:
        new_columns['order_to_pickup_tat'] = None
    
    if pickup_date_dt and ofd_date_dt:
        new_columns['pickup_to_ofd_tat'] = df.apply(
            lambda row: calculate_tat(
                row.get(pickup_date_dt),
                row.get(ofd_date_dt)
            ), axis=1
        )
    else:
        new_columns['pickup_to_ofd_tat'] = None
    
    if ofd_date_dt and delivery_date_dt:
        new_columns['ofd_to_delivery_tat'] = df.apply(
            lambda row: calculate_tat(
                row.get(ofd_date_dt),
                row.get(delivery_date_dt)
            ), axis=1
        )
    else:
        new_columns['ofd_to_delivery_tat'] = None
    
    if order_date_dt and delivery_date_dt:
        new_columns['total_tat'] = df.apply(
            lambda row: calculate_tat(
                row.get(order_date_dt),
                row.get(delivery_date_dt)
            ), axis=1
        )
    else:
        new_columns['total_tat'] = None
    
    # Order risk score
    if 'order_risk_score' not in df.columns:
        new_columns['order_risk_score'] = 0
    
    # Add processed timestamp
    new_columns['processed_at'] = datetime.now()
    
    # Add all new columns at once using pd.concat to avoid fragmentation
    if new_columns:
        new_df = pd.DataFrame(new_columns, index=df.index)
        df = pd.concat([df, new_df], axis=1)
    
    # Clean up temporary columns
    temp_cols = [col for col in df.columns if col.endswith('_parsed') or col == 'status_upper']
    df = df.drop(columns=temp_cols, errors='ignore')
    
    return df
