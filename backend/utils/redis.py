"""
Redis connection utility
"""
import redis
import os
from backend.config import REDIS_URL

# Global Redis client instance
_redis_client = None

def get_redis_client():
    """
    Get or create Redis client instance (singleton pattern)
    """
    global _redis_client
    if _redis_client is None:
        if not REDIS_URL:
            raise ValueError("REDIS_URL not found in environment variables")
        print("Connecting to Redis...")
        try:
            _redis_client = redis.from_url(REDIS_URL)
            _redis_client.ping()
            print("✅ Redis Client Connected")
        except Exception as e:
            print(f"❌ Redis Client Error: {e}")
            raise
    return _redis_client
