"""
Preprocessing utilities for single row processing
"""
import pandas as pd
from typing import Dict, Any
from backend.data_preprocessing import preprocess_shipping_data


def preprocess_shipping_detail(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Preprocess a single shipping detail row
    Converts dict to DataFrame, processes it, and returns as dict
    """
    # Convert single row to DataFrame
    df = pd.DataFrame([row])
    
    # Process using the main preprocessing function
    processed_df = preprocess_shipping_data(df)
    
    # Convert back to dict (first row)
    if len(processed_df) > 0:
        return processed_df.iloc[0].to_dict()
    
    return row
