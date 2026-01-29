"""
In-memory data store (replaces Redis)
Stores shipping data temporarily in memory
"""
from typing import Dict, List, Any, Optional
import time

# In-memory data store
# Key: session_id, Value: dict with 'data' and 'metadata'
_shipping_data_store: Dict[str, Dict[str, Any]] = {}


def store_shipping_data(session_id: str, data: List[Dict[str, Any]], metadata: Dict[str, Any] = None):
    """Store shipping data in memory"""
    _shipping_data_store[session_id] = {
        'data': data,
        'metadata': metadata or {},
        'stored_at': time.time()
    }
    print(f"✅ Stored {len(data)} records for session {session_id}")


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


def clear_shipping_data(session_id: str):
    """Clear shipping data for a session"""
    if session_id in _shipping_data_store:
        del _shipping_data_store[session_id]
        print(f"🗑️  Cleared data for session {session_id}")
