"""
Admin API endpoints
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/queue")
async def get_queue_info():
    """
    GET /api/admin/queue
    Queue endpoints have been removed along with Redis and RQ
    """
    return {
        "success": False,
        "message": "Queue functionality has been removed. Redis and RQ have been removed from the backend.",
        "timestamp": datetime.now().isoformat()
    }
