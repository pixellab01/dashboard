"""
In-memory data store (replaces Redis)
Stores shipping data temporarily in memory
"""
from typing import Dict, List, Any, Optional
import time
import pandas as pd

# In-memory data store
# Key: session_id, Value: dict with 'data', 'metadata', and 'analytics'
_shipping_data_store: Dict[str, Dict[str, Any]] = {}


def store_shipping_data(session_id: str, data: List[Dict[str, Any]], metadata: Dict[str, Any] = None, df: Optional[pd.DataFrame] = None):
    """Store shipping data in memory"""
    _shipping_data_store[session_id] = {
        'data': data,
        'metadata': metadata or {},
        'analytics': {},  # Store computed analytics here
        'dataframe': df,  # Store DataFrame to avoid repeated conversions
        'stored_at': time.time()
    }
    print(f"✅ Stored {len(data)} records for session {session_id}")
    if df is not None:
        print(f"✅ Stored DataFrame: {df.shape[0]} rows, {df.shape[1]} columns")


def get_shipping_data(session_id: str) -> Optional[List[Dict[str, Any]]]:
    """Get shipping data from memory"""
    if session_id in _shipping_data_store:
        return _shipping_data_store[session_id]['data']
    return None


def get_shipping_metadata(session_id: str) -> Optional[Dict[str, Any]]:
    """Get shipping metadata from memory"""
    if session_id in _shipping_data_store:
        return _shipping_data_store[session_id].get('metadata', {})
    return None


def store_analytics(session_id: str, analytics_type: str, data: Any, filters: Optional[Dict[str, Any]] = None):
    """Store computed analytics results"""
    if session_id not in _shipping_data_store:
        return
    
    # Create cache key based on analytics type and filters
    cache_key = analytics_type
    if filters:
        # Create a stable key from filters
        filter_key = "_".join(f"{k}:{v}" for k, v in sorted(filters.items()) if v)
        if filter_key:
            cache_key = f"{analytics_type}_{filter_key}"
    
    if 'analytics' not in _shipping_data_store[session_id]:
        _shipping_data_store[session_id]['analytics'] = {}
    
    _shipping_data_store[session_id]['analytics'][cache_key] = {
        'data': data,
        'filters': filters,
        'computed_at': time.time()
    }
    print(f"✅ Cached analytics '{analytics_type}' for session {session_id}")


def get_analytics(session_id: str, analytics_type: str, filters: Optional[Dict[str, Any]] = None) -> Optional[Any]:
    """Get cached analytics results"""
    if session_id not in _shipping_data_store:
        return None
    
    analytics_cache = _shipping_data_store[session_id].get('analytics', {})
    
    # Try exact match first
    cache_key = analytics_type
    if filters:
        filter_key = "_".join(f"{k}:{v}" for k, v in sorted(filters.items()) if v)
        if filter_key:
            cache_key = f"{analytics_type}_{filter_key}"
    
    if cache_key in analytics_cache:
        return analytics_cache[cache_key]['data']
    
    # If no filters, try to find any cached version
    if not filters:
        for key, value in analytics_cache.items():
            if key.startswith(analytics_type) and not value.get('filters'):
                return value['data']
    
    return None


def store_dataframe(session_id: str, df: pd.DataFrame):
    """Store DataFrame in memory to avoid repeated conversions"""
    if session_id not in _shipping_data_store:
        _shipping_data_store[session_id] = {
            'data': None,
            'metadata': {},
            'analytics': {},
            'dataframe': None,
            'stored_at': time.time()
        }
    _shipping_data_store[session_id]['dataframe'] = df
    print(f"✅ Stored DataFrame for session {session_id} ({df.shape[0]} rows, {df.shape[1]} columns)")


def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    """Get cached DataFrame"""
    if session_id in _shipping_data_store:
        return _shipping_data_store[session_id].get('dataframe')
    return None


def clear_shipping_data(session_id: str):
    """Clear shipping data for a session"""
    if session_id in _shipping_data_store:
        del _shipping_data_store[session_id]
        print(f"🗑️  Cleared data for session {session_id}")
