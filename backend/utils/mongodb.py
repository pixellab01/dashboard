"""
MongoDB connection utility
"""
from pymongo import MongoClient
from typing import Optional
import os
from backend.config import MONGODB_URI

# Global MongoDB client instance
_client: Optional[MongoClient] = None
_client_promise: Optional[MongoClient] = None


def get_mongodb_client() -> MongoClient:
    """
    Get or create MongoDB client instance (singleton pattern)
    """
    global _client
    
    if _client is None:
        if not MONGODB_URI:
            raise ValueError("MONGODB_URI not found in environment variables")
        
        _client = MongoClient(MONGODB_URI)
        # Test connection
        try:
            _client.admin.command('ping')
            print("✅ MongoDB Client Connected")
        except Exception as e:
            print(f"❌ MongoDB Client Error: {e}")
            raise
    
    return _client


def get_database(db_name: str = "dashboard"):
    """
    Get database instance
    """
    client = get_mongodb_client()
    return client[db_name]


def get_users_collection():
    """
    Get users collection
    """
    db = get_database()
    return db.users
