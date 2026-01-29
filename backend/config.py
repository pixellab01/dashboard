"""
Configuration settings for the backend
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_TTL_SECONDS = int(os.getenv("REDIS_TTL_SECONDS", "1800"))  # 30 minutes

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

# Google Drive Configuration
GOOGLE_DRIVE_CLIENT_ID = os.getenv("GOOGLE_DRIVE_CLIENT_ID")
GOOGLE_DRIVE_CLIENT_SECRET = os.getenv("GOOGLE_DRIVE_CLIENT_SECRET")
GOOGLE_DRIVE_REDIRECT_URI = os.getenv("GOOGLE_DRIVE_REDIRECT_URI")
GOOGLE_DRIVE_REFRESH_TOKEN = os.getenv("GOOGLE_DRIVE_REFRESH_TOKEN")
GOOGLE_DRIVE_CLIENT_EMAIL = os.getenv("GOOGLE_DRIVE_CLIENT_EMAIL")
GOOGLE_DRIVE_PRIVATE_KEY = os.getenv("GOOGLE_DRIVE_PRIVATE_KEY")
GOOGLE_DRIVE_FOLDER_ID = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

# Debug
DEBUG_ANALYTICS = os.getenv("DEBUG_ANALYTICS", "false").lower() == "true"
