"""
Persistent & Cached Data Store
- Uses Redis to store session metadata (e.g., path to data file).
- Uses Redis to cache analytics results.
- Raw data is stored on disk in Parquet format.
"""
from typing import Dict, Any, Optional
import json
import pandas as pd
import os
from backend.utils.redis import get_redis_client

# Directory to store cached data files
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Redis key prefixes for better organization
SESSION_KEY_PREFIX = "session:"
ANALYTICS_CACHE_PREFIX = "analytics_cache:"

# TTL for session and analytics cache in seconds (e.g., 24 hours)
SESSION_TTL = 86400
ANALYTICS_TTL = 86400

def get_parquet_path(session_id: str) -> str:
    """Generate a consistent file path for a session's Parquet file."""
    return os.path.join(CACHE_DIR, f"{session_id}.parquet")

def store_dataframe_as_parquet(df: pd.DataFrame, session_id: str):
    """
    Saves a DataFrame to a Parquet file and stores its path in Redis.
    """
    redis = get_redis_client()
    file_path = get_parquet_path(session_id)
    
    # Save DataFrame to Parquet
    try:
        df.to_parquet(file_path)
    except Exception as e:
        print(f"❌ Error writing Parquet file {file_path}: {e}")
        # Optionally, remove the corrupted file or mark session as failed
        if os.path.exists(file_path):
            os.remove(file_path)
        redis.hset(session_key, "status", "write_failed")
        redis.hset(session_key, "error_message", str(e))
        return

    
    # Store metadata in Redis
    session_key = f"{SESSION_KEY_PREFIX}{session_id}"
    redis.hset(session_key, mapping={
        "parquet_path": file_path,
        "record_count": str(len(df)),
        "status": "processed"
    })
    redis.expire(session_key, SESSION_TTL)
    print(f"✅ Stored DataFrame for session {session_id} at {file_path}")

def get_dataframe(session_id: str) -> Optional[pd.DataFrame]:
    """
    Loads a DataFrame from a Parquet file using the path stored in Redis.
    """
    redis = get_redis_client()
    session_key = f"{SESSION_KEY_PREFIX}{session_id}"
    
    file_path_bytes = redis.hget(session_key, "parquet_path")
    file_path = file_path_bytes.decode('utf-8') if file_path_bytes else None
    
    if file_path and os.path.exists(file_path):
        print(f"DEBUG: Loading DataFrame for session {session_id} from {file_path}")
        try:
            return pd.read_parquet(file_path)
        except Exception as e:
            print(f"❌ Error reading Parquet file {file_path}: {e}")
            redis.hset(session_key, "status", "read_failed")
            redis.hset(session_key, "error_message", str(e))
            # Consider deleting the corrupted file and invalidating the session
            if os.path.exists(file_path):
                os.remove(file_path)
            return None
        
    print(f"❌ No Parquet file found for session {session_id}")
    return None

def store_analytics(session_id: str, analytics_type: str, data: Any, filters: Optional[Dict[str, Any]] = None):
    """Store computed analytics results in Redis cache."""
    redis = get_redis_client()
    cache_key = f"{ANALYTICS_CACHE_PREFIX}{session_id}:{analytics_type}"
    
    if filters:
        filter_key = "_".join(f"{k}:{v}" for k, v in sorted(filters.items()) if v)
        if filter_key:
            cache_key = f"{cache_key}_{filter_key}"
            
    redis.set(cache_key, json.dumps(data), ex=ANALYTICS_TTL)
    print(f"✅ Cached analytics '{analytics_type}' for session {session_id}")

def get_analytics(session_id: str, analytics_type: str, filters: Optional[Dict[str, Any]] = None) -> Optional[Any]:
    """Get cached analytics results from Redis."""
    redis = get_redis_client()
    cache_key = f"{ANALYTICS_CACHE_PREFIX}{session_id}:{analytics_type}"

    if filters:
        filter_key = "_".join(f"{k}:{v}" for k, v in sorted(filters.items()) if v)
        if filter_key:
            cache_key = f"{cache_key}_{filter_key}"

    cached_data = redis.get(cache_key)
    if cached_data:
        print(f"✅ Cache hit for analytics '{analytics_type}' for session {session_id}")
        return json.loads(cached_data)
        
    print(f"❌ Cache miss for analytics '{analytics_type}' for session {session_id}")
    return None
