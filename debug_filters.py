import sys
import os
import pandas as pd
sys.path.append(os.getcwd())

from backend.data_store import get_dataframe
from backend.analytics import COLUMN_MAP

# Mock sessionId - assuming the first file in data_cache is a valid session
cache_dir = "data_cache"
parquet_files = [f for f in os.listdir(cache_dir) if f.endswith('.parquet')]
if not parquet_files:
    print("No parquet files found in data_cache")
    sys.exit(1)

session_file = parquet_files[0]
fake_session_id = session_file.replace('.parquet', '').replace('session_', '')

print(f"Using session: {fake_session_id} from file {session_file}")

# Simulate logic from main.py
df = pd.read_parquet(os.path.join(cache_dir, session_file))

print(f"DEBUG: DataFrame columns: {df.columns.tolist()}")

def resolve_col(keys):
    for k in keys:
        if k in df.columns:
            return k
    return None

payment_col = resolve_col(COLUMN_MAP.get('payment', ['payment_method', 'payment__method']))
print(f"DEBUG: Resolved payment_col: {payment_col}")

if payment_col:
    values = df[payment_col].dropna().unique().tolist()
    print(f"DEBUG: Raw values: {values[:10]}")
    
    def is_valid(v):
        if v is None: return False
        s = str(v).strip()
        return s and s.lower() not in ['', 'none', 'n/a', 'na', 'null', 'undefined', 'nan']

    valid_values = [v for v in values if is_valid(v)]
    print(f"DEBUG: Validated values: {valid_values[:10]}")
else:
    print("DEBUG: Payment column not found")
