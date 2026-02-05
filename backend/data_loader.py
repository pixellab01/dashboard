"""
Data Loading Utilities
Helper functions to load data from various sources
Note: Redis has been removed. These functions now return processed data directly.
"""
import os
import pandas as pd
from typing import List, Dict, Any, Optional, Generator
import json
import uuid

from backend.data_preprocessing import preprocess_shipping_data


def load_data_from_json(data: List[Dict[str, Any]], session_id: Optional[str] = None) -> tuple:
    """
    Load data from JSON list and preprocess it
    Returns (session_id, processed_data)
    Note: Redis has been removed. Data is returned directly.
    """
    if session_id is None:
        session_id = f"session_{uuid.uuid4().hex[:16]}"
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Preprocess data
    df = preprocess_shipping_data(df)
    
    # Convert back to list of dicts
    data_list = df.to_dict('records')
    
    return session_id, data_list


def load_data_from_dataframe(df: pd.DataFrame, session_id: Optional[str] = None) -> tuple:
    """
    Load data from pandas DataFrame and preprocess it
    Returns (session_id, processed_data)
    Note: Redis has been removed. Data is returned directly.
    """
    if session_id is None:
        session_id = f"session_{uuid.uuid4().hex[:16]}"
    
    # Preprocess data
    df = preprocess_shipping_data(df)
    
    # Convert to list of dicts
    data_list = df.to_dict('records')
    
    return session_id, data_list


def load_data_from_file(file_path: str, session_id: Optional[str] = None, batch_size: int = 1000) -> Generator[tuple, None, None]:
    """
    Load data from file (CSV, Excel, JSON) and preprocess it in batches.
    Converts the file to Parquet format first for efficiency.
    Returns a generator of (session_id, processed_data_chunk)
    """
    if session_id is None:
        session_id = f"session_{uuid.uuid4().hex[:16]}"
    
    parquet_path = file_path.rsplit('.', 1)[0] + '.parquet'
    if not os.path.exists(parquet_path):
        convert_to_parquet(file_path, parquet_path)
        
    # Now, read from the parquet file in batches
    parquet_file = pd.read_parquet(parquet_path)
    for i in range(0, len(parquet_file), batch_size):
        chunk_df = parquet_file[i:i + batch_size]
        yield load_data_from_dataframe(chunk_df, session_id)


def convert_to_parquet(file_path: str, parquet_path: str):
    """
    Convert a file (CSV, Excel, JSON) to Parquet format.
    """
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file_path)
    elif file_path.endswith('.json'):
        with open(file_path, 'r') as f:
            data = json.load(f)
        if isinstance(data, list):
            df = pd.DataFrame(data)
        else:
            raise ValueError("JSON file must contain a list of objects")
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
    
    df.to_parquet(parquet_path)
