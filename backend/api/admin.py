"""
Admin API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime
from backend.rq_queue import get_queue_stats, get_job_status

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/queue")
async def get_queue_info(sessionId: Optional[str] = Query(None)):
    """
    GET /api/admin/queue
    Get queue statistics and job status
    Useful for monitoring the analytics computation queue
    """
    try:
        # If sessionId provided, get specific job status
        if sessionId:
            job_status = get_job_status(sessionId)
            
            if not job_status:
                raise HTTPException(
                    status_code=404,
                    detail="Job not found for this session"
                )
            
            return {
                "success": True,
                "job": job_status
            }
        
        # Otherwise, get queue statistics
        stats = get_queue_stats()
        
        return {
            "success": True,
            "stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching queue stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch queue stats: {str(e)}"
        )
