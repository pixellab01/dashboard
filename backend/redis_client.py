"""
Redis Client Configuration and Utilities
"""
import json
import redis
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import hashlib
import base64

from backend.config import REDIS_URL, REDIS_TTL_SECONDS


class RedisClient:
    """Singleton Redis client"""
    _instance: Optional[redis.Redis] = None
    
    @classmethod
    def get_client(cls) -> redis.Redis:
        """Get or create Redis client instance"""
        if cls._instance is None:
            cls._instance = redis.from_url(
                REDIS_URL,
                decode_responses=False,  # We'll handle JSON encoding/decoding ourselves
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            try:
                cls._instance.ping()
                print("Redis Client Connected")
            except Exception as e:
                print(f"Redis Client Error: {e}")
        return cls._instance


def get_redis_client() -> redis.Redis:
    """Get Redis client instance"""
    return RedisClient.get_client()


def save_shipping_data_to_redis(data: List[Dict[str, Any]], session_id: str) -> None:
    """Save shipping data to Redis with TTL"""
    client = get_redis_client()
    key = f"shipping:data:{session_id}"
    
    # Save data as JSON string with TTL
    client.setex(key, REDIS_TTL_SECONDS, json.dumps(data, default=str))
    
    # Also save metadata with same TTL
    metadata_key = f"shipping:meta:{session_id}"
    metadata = {
        "totalRows": len(data),
        "timestamp": datetime.now().isoformat(),
        "sessionId": session_id,
        "expiresAt": (datetime.now() + timedelta(seconds=REDIS_TTL_SECONDS)).isoformat(),
    }
    client.setex(metadata_key, REDIS_TTL_SECONDS, json.dumps(metadata, default=str))


def get_shipping_data_from_redis(session_id: str) -> Optional[List[Dict[str, Any]]]:
    """Get shipping data from Redis"""
    client = get_redis_client()
    key = f"shipping:data:{session_id}"
    
    data = client.get(key)
    if not data:
        return None
    
    return json.loads(data)


def get_shipping_metadata_from_redis(session_id: str) -> Optional[Dict[str, Any]]:
    """Get shipping metadata from Redis"""
    client = get_redis_client()
    key = f"shipping:meta:{session_id}"
    
    data = client.get(key)
    if not data:
        return None
    
    return json.loads(data)


def save_analytics_to_redis(session_id: str, analytics_type: str, data: Any) -> None:
    """Save computed analytics to Redis"""
    client = get_redis_client()
    
    # Handle different key formats
    if analytics_type.startswith("analytics:"):
        key = analytics_type
    elif ":" in analytics_type:
        key = f"analytics:{session_id}:{analytics_type}"
    else:
        # Old format for backward compatibility
        key = f"analytics:{analytics_type}:{session_id}"
    
    client.setex(key, REDIS_TTL_SECONDS, json.dumps(data, default=str))


def get_analytics_from_redis(session_id: str, analytics_type: str) -> Optional[Any]:
    """Get computed analytics from Redis"""
    client = get_redis_client()
    
    # Support both old and new formats
    if ":" in analytics_type:
        key = analytics_type if analytics_type.startswith("analytics:") else f"analytics:{analytics_type}"
    else:
        key = f"analytics:{analytics_type}:{session_id}"
    
    data = client.get(key)
    if not data:
        return None
    
    return json.loads(data)


def get_key_ttl(key: str) -> int:
    """Get remaining TTL (in seconds) for a key"""
    client = get_redis_client()
    ttl = client.ttl(key)
    return ttl  # Returns -1 if key doesn't exist, -2 if key exists but has no TTL


def get_shipping_data_ttl(session_id: str) -> int:
    """Get remaining TTL for shipping data"""
    key = f"shipping:data:{session_id}"
    return get_key_ttl(key)


def is_session_valid(session_id: str) -> bool:
    """Check if session data is still valid (has TTL > 0)"""
    ttl = get_shipping_data_ttl(session_id)
    return ttl > 0


def is_source_data_valid(session_id: str) -> bool:
    """Check if source data exists - if not, analytics are invalid"""
    shipping_data = get_shipping_data_from_redis(session_id)
    return shipping_data is not None and len(shipping_data) > 0


def get_validated_analytics(session_id: str, analytics_type: str) -> Optional[Any]:
    """Get analytics only if source data is still valid"""
    if not is_source_data_valid(session_id):
        print(f"[Analytics Validation] Source data expired for session {session_id}. Returning None.")
        return None
    
    return get_analytics_from_redis(session_id, analytics_type)


def generate_session_id() -> str:
    """Generate a unique session ID"""
    import time
    import random
    import string
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return f"session_{timestamp}_{random_str}"


def build_analytics_key(
    session_id: str,
    analytics_type: str,
    filters: Optional[Dict[str, Any]] = None
) -> str:
    """
    Build Redis key for analytics based on filters
    Format: analytics:{sessionId}:{filterPath}:{analyticsType}
    """
    if not filters or not any([
        filters.get("channel"),
        filters.get("sku"),
        filters.get("productName"),
        filters.get("startDate"),
        filters.get("endDate"),
        filters.get("orderStatus"),
        filters.get("paymentMethod"),
    ]):
        return f"analytics:{session_id}:base:{analytics_type}"
    
    parts = [session_id]
    
    if filters.get("channel"):
        parts.append(f"channel:{filters['channel']}")
    
    if filters.get("sku"):
        sku_value = filters["sku"]
        if isinstance(sku_value, list) and len(sku_value) > 0:
            sku_value = sku_value[0]
        parts.append(f"sku:{sku_value}")
    
    if filters.get("productName"):
        product_value = filters["productName"]
        if isinstance(product_value, list) and len(product_value) > 0:
            product_value = product_value[0]
        parts.append(f"product:{product_value}")
    
    # For date/status/payment filters, use a hash of the filter combination
    other_filters = []
    if filters.get("startDate"):
        other_filters.append(f"start:{filters['startDate']}")
    if filters.get("endDate"):
        other_filters.append(f"end:{filters['endDate']}")
    if filters.get("orderStatus"):
        other_filters.append(f"status:{filters['orderStatus']}")
    if filters.get("paymentMethod"):
        other_filters.append(f"payment:{filters['paymentMethod']}")
    
    if other_filters:
        # Use a short hash for complex filter combinations
        filter_str = "|".join(other_filters)
        filter_hash = base64.b64encode(filter_str.encode()).decode()[:16]
        parts.append(f"filters:{filter_hash}")
    
    return f"analytics:{':'.join(parts)}:{analytics_type}"


def get_analytics_by_filters(
    session_id: str,
    analytics_type: str,
    filters: Optional[Dict[str, Any]] = None
) -> Optional[Any]:
    """Get analytics with proper key building from filters"""
    key = build_analytics_key(session_id, analytics_type, filters)
    client = get_redis_client()
    data = client.get(key)
    if not data:
        return None
    return json.loads(data)
