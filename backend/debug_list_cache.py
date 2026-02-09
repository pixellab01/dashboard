
import os

CACHE_DIR = os.path.join(os.path.dirname(__file__), "data_cache")
print(f"Checking cache dir: {CACHE_DIR}")

if os.path.exists(CACHE_DIR):
    files = os.listdir(CACHE_DIR)
    print(f"Files found: {files}")
    
    for f in files:
        if f.endswith(".parquet"):
            print(f"Found parquet file: {f}")
else:
    print("Cache directory does not exist.")
