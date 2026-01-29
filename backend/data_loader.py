"""
Data Loading Utilities
Helper functions to load data from various sources
Note: Redis has been removed. These functions now return processed data directly.
"""
import pandas as pd
from typing import List, Dict, Any, Optional
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


def load_data_from_file(file_path: str, session_id: Optional[str] = None) -> tuple:
    """
    Load data from file (CSV, Excel, JSON) and preprocess it
    Returns (session_id, processed_data)
    Note: Redis has been removed. Data is returned directly.
    """
    if session_id is None:
        session_id = f"session_{uuid.uuid4().hex[:16]}"
    
    # Read file based on extension
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
    
    # Load and preprocess
    return load_data_from_dataframe(df, session_id)
