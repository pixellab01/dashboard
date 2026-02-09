
import polars as pl
import pandas as pd
from backend.analytics import normalize_dataframe_pl, filter_shipping_data_pl, COLUMN_MAP

def verify_ndr_filters():
    print("Verifying NDR Filters...")

    # 1. Create Sample DataFrame
    data = {
        "order_id": ["1", "2", "3", "4"],
        "status": ["NDR", "DELIVERED", "NDR", "NDR"],
        "latest_ndr_reason": ["Customer Refused", "None", "Address Issue", "Customer Refused"],
        "order_date": ["2023-10-01", "2023-10-02", "2023-10-03", "2023-10-04"]
    }
    df = pl.DataFrame(data)
    print("Original DataFrame:")
    print(df)

    # 2. Normalize
    print("\nNormalizing DataFrame...")
    # Ensure COLUMN_MAP has ndr_description
    if "ndr_description" not in COLUMN_MAP:
        print("❌ Error: ndr_description not found in COLUMN_MAP")
        return

    normalized_df = normalize_dataframe_pl(df)
    print("Normalized DataFrame:")
    print(normalized_df.select(["_status", "_ndr_description"]))
    
    # Check if _ndr_description column exists
    if "_ndr_description" not in normalized_df.columns:
        print("❌ Error: _ndr_description column not created")
        return
    
    # Verify values
    reasons = normalized_df["_ndr_description"].to_list()
    expected_reasons = ["Customer Refused", "None", "Address Issue", "Customer Refused"] 
    # Note: normalize might strip chars, so let's verify exact logic
    # In my change: pl.col(ndr_desc_col).cast(pl.Utf8).str.strip_chars() if ... else ...
    # So "None" string will be "None" (or "Unknown" if it was null/missing, but here it is "None" string)
    
    print(f"NDR Descriptions: {reasons}")

    # 3. Test Filtering
    print("\nTesting Filter: ndrDescription = 'Customer Refused'")
    filters = {"ndrDescription": "Customer Refused"}
    filtered_df = filter_shipping_data_pl(normalized_df, filters)
    
    print("Filtered DataFrame count:", filtered_df.height)
    
    # We expect 2 rows (order 1 and 4)
    count = filtered_df.height
    if count == 2:
        print("✅ Filter 'Customer Refused' passed (Count: 2)")
    else:
        print(f"❌ Filter 'Customer Refused' failed (Count: {count}, Expected: 2)")

    # 4. Test List Filtering
    print("\nTesting Filter: ndrDescription = ['Address Issue', 'Customer Refused']")
    filters_list = {"ndrDescription": ["Address Issue", "Customer Refused"]}
    filtered_df_list = filter_shipping_data_pl(normalized_df, filters_list)
    
    count_list = filtered_df_list.height
    if count_list == 3:
        print("✅ Filter list passed (Count: 3)")
    else:
        print(f"❌ Filter list failed (Count: {count_list}, Expected: 3)")

if __name__ == "__main__":
    verify_ndr_filters()
