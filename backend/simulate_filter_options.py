
import pandas as pd
import os
import sys

# Mocking the COLUMN_MAP from analytics.py locally to ensure we test the INTENDED logic
COLUMN_MAP = {
    "status": ["original_status", "status", "delivery_status"],
    "payment": ["payment__method", "payment_method", "paymentmethod", "payment", "method", "type", "Payment Type"],
    "sku": ["channel__s_k_u", "master__s_k_u", "master_sku", "master_s_k_u", "sku", "channel_sku", "channel_s_k_u"],
    "product": ["product__name", "product_name", "product__name"],
    "channel": ["channel", "source", "platform", "channel_name"],
    "state": ["state", "address__state"],
    "courier": ["courier_company", "courier__company", "master_courier", "master__courier", "courier_name"],
    "ndr_description": ["latest__n_d_r__reason", "latest_ndr_reason", "ndr_reason", "ndr_description", "reason"],
}

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data_cache")
SESSION_FILE = "session_9069db20ec24414a9f2a35371e5125db.parquet" # The file we found earlier
FILE_PATH = os.path.join(CACHE_DIR, SESSION_FILE)

def simulate_get_filter_options():
    print(f"Loading {FILE_PATH}...")
    try:
        df = pd.read_parquet(FILE_PATH)
        print("DataFrame loaded.")
        
        # Helper to find column from mapped keys (COPIED FROM main.py)
        def resolve_col(keys):
            for k in keys:
                if k in df.columns:
                    print(f"Found column: {k}")
                    return k
            print(f"Column not found for keys: {keys}")
            return None

        # Resolve columns (COPIED FROM main.py logic)
        channel_col = resolve_col(COLUMN_MAP.get('channel', ['channel', 'Channel', 'channel__']))
        sku_col = resolve_col(COLUMN_MAP.get('sku', ['master__s_k_u', 'sku']))
        product_col = resolve_col(COLUMN_MAP.get('product', ['product_name', 'product__name']))
        status_col = resolve_col(COLUMN_MAP.get('status', ['status', 'original_status']))
        payment_col = resolve_col(COLUMN_MAP.get('payment', ['payment_method', 'payment__method']))
        state_col = resolve_col(COLUMN_MAP.get('state', ['state', 'address__state']))
        courier_col = resolve_col(COLUMN_MAP.get('courier', ['courier_company', 'courier__company', 'master_courier', 'courier_name']))
        
        # NDR Description Resolution
        ndr_desc_keys = COLUMN_MAP.get('ndr_description', ['latest__n_d_r__reason', 'latest_ndr_reason', 'ndr_reason', 'ndr_description'])
        print(f"Looking for NDR keys: {ndr_desc_keys}")
        ndr_desc_col = resolve_col(ndr_desc_keys)
        
        if not ndr_desc_col:
            print("Fallback search for NDR...")
            for col in df.columns:
                lower_col = str(col).lower()
                if "ndr" in lower_col and "reason" in lower_col:
                    print(f"Found fallback column: {col}")
                    ndr_desc_col = col
                    break

        def get_unique_values(df, col_name):
            if not col_name or col_name not in df.columns:
                return []
            
            def is_valid(v):
                if v is None: return False
                s = str(v).strip()
                return s and s.lower() not in ['', 'none', 'n/a', 'na', 'null', 'undefined', 'nan']

            values = df[col_name].dropna().unique().tolist()
            return [v for v in values if is_valid(v)]

        ndr_descriptions = get_unique_values(df, ndr_desc_col)
        print(f"NDR Descriptions found ({len(ndr_descriptions)}):")
        print(ndr_descriptions[:10])

        if not ndr_descriptions:
            if "_ndr_description" in df.columns:
                 print("Checking _ndr_description...")
                 ndr_descriptions = get_unique_values(df, '_ndr_description')
                 print(f"NDR Descriptions from _ndr_description: {ndr_descriptions[:10]}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    simulate_get_filter_options()
