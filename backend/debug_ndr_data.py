
import pandas as pd
import os
import glob

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data_cache")
parquet_files = glob.glob(os.path.join(CACHE_DIR, "*.parquet"))

print(f"Found {len(parquet_files)} parquet files in {CACHE_DIR}")

for file_path in parquet_files:
    print(f"\nTrying to load {os.path.basename(file_path)}...")
    try:
        df = pd.read_parquet(file_path)
        print(f"✅ Successfully loaded {os.path.basename(file_path)}")
        print(f"Columns: {list(df.columns)}")
        
        # Check for ndr/reason columns
        ndr_cols = [c for c in df.columns if "ndr" in c.lower() or "reason" in c.lower()]
        print(f"\nPotential NDR Columns: {ndr_cols}")
        
        for col in ndr_cols:
            print(f"\n--- {col} ---")
            # Convert to string to see values clearly
            unique_vals = df[col].astype(str).unique()
            print(f"Unique count: {len(unique_vals)}")
            print(f"First 10 values: {unique_vals[:10]}")
            print(f"Null count: {df[col].isnull().sum()}")
            
        print("\n--- SAMPLE DATA (Head) ---")
        print(df[ndr_cols].head().to_string() if ndr_cols else "No NDR columns found")
        
        break # Stop after first successful load
    except Exception as e:
        print(f"❌ Failed to load: {e}")
