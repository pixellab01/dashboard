"""
Stats API endpoints
"""
from fastapi import APIRouter, HTTPException
from backend.utils.mongodb import get_users_collection

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats")
async def get_stats():
    """
    GET /api/stats
    Get dashboard statistics
    """
    try:
        users_collection = get_users_collection()
        total_users = users_collection.count_documents({})
        
        return {
            "success": True,
            "totalUsers": total_users,
            "message": "Excel data is now read directly from Google Drive, not stored in MongoDB"
        }
    except Exception as e:
        print(f"Error fetching stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch stats"
        )
