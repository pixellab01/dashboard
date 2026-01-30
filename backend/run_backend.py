#!/usr/bin/env python3
"""
Run the FastAPI backend server
"""
import sys
import os

# Add parent directory to path so backend module can be imported
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Set PYTHONPATH for uvicorn subprocess
os.environ['PYTHONPATH'] = parent_dir + os.pathsep + os.environ.get('PYTHONPATH', '')

import uvicorn

if __name__ == "__main__":
    # Get the backend directory for reload watching
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Use import string format for reload to work properly
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        reload_dirs=[backend_dir],  # Watch backend directory for changes
        log_level="info",
        timeout_keep_alive=300,  # 5 minutes keep-alive timeout
        timeout_graceful_shutdown=30  # 30 seconds graceful shutdown
    )
