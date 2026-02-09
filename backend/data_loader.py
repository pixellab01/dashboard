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
from backend.data_store import store_dataframe_as_parquet


def process_and_store_data(df: pd.DataFrame, session_id: str):
    """
    Preprocesses a DataFrame and stores it in the persistent cache.
    This is the core "process-once" function.
    """
    # Preprocess data
    print(f"Starting preprocessing for session {session_id}...")
    df_processed = preprocess_shipping_data(df)
    print(f"Preprocessing complete. Shape: {df_processed.shape}")
    
    # Store the processed dataframe
    store_dataframe_as_parquet(df_processed, session_id)
    
    return session_id, len(df_processed)


def load_data_from_json(data: List[Dict[str, Any]], session_id: str):
    """
    Loads data from a JSON object, processes it, and stores it.
    """
    print("Loading data from JSON object...")
    df = pd.DataFrame(data)
    return process_and_store_data(df, session_id)


def load_data_from_dataframe(df: pd.DataFrame, session_id: str):
    """
    Processes a DataFrame and stores it.
    """
    print("Loading data from DataFrame...")
    return process_and_store_data(df, session_id)


def load_data_from_file(file_path: str, session_id: str):
    """
    Loads data from a file (CSV, Excel, JSON), processes it, and stores it.
    """
    print(f"Loading data from file: {file_path}")
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path, low_memory=False)
    elif file_path.endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file_path)
    elif file_path.endswith('.json'):
        df = pd.read_json(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
    
    return process_and_store_data(df, session_id)
