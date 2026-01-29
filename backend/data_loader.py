"""
Data Loading Utilities
Helper functions to load data from various sources and save to Redis
"""
import pandas as pd
from typing import List, Dict, Any, Optional
import json

from backend.redis_client import save_shipping_data_to_redis, generate_session_id
from backend.data_preprocessing import preprocess_shipping_data


def load_data_from_json(data: List[Dict[str, Any]], session_id: Optional[str] = None) -> str:
    """
    Load data from JSON list and save to Redis
    Returns session_id
    """
    if session_id is None:
        session_id = generate_session_id()
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Preprocess data
    df = preprocess_shipping_data(df)
    
    # Convert back to list of dicts
    data_list = df.to_dict('records')
    
    # Save to Redis
    save_shipping_data_to_redis(data_list, session_id)
    
    return session_id


def load_data_from_dataframe(df: pd.DataFrame, session_id: Optional[str] = None) -> str:
    """
    Load data from pandas DataFrame and save to Redis
    Returns session_id
    """
    if session_id is None:
        session_id = generate_session_id()
    
    # Preprocess data
    df = preprocess_shipping_data(df)
    
    # Convert to list of dicts
    data_list = df.to_dict('records')
    
    # Save to Redis
    save_shipping_data_to_redis(data_list, session_id)
    
    return session_id


def load_data_from_file(file_path: str, session_id: Optional[str] = None) -> str:
    """
    Load data from file (CSV, Excel, JSON) and save to Redis
    Returns session_id
    """
    if session_id is None:
        session_id = generate_session_id()
    
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
