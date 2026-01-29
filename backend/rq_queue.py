"""
Redis Queue (RQ) Configuration for Async Analytics Computation
"""
from redis import Redis
from rq import Queue, Worker, Connection
from rq.job import Job
from typing import Optional, Dict, Any
import os

from backend.config import REDIS_URL
from backend.analytics import compute_all_analytics


def get_redis_connection() -> Redis:
    """Get Redis connection for RQ"""
    return Redis.from_url(REDIS_URL)


# Create queue
analytics_queue = Queue('analytics-computation', connection=get_redis_connection())


def enqueue_analytics_computation(session_id: str, filters: Optional[Dict[str, Any]] = None, priority: int = 10) -> Optional[Job]:
    """
    Add analytics computation job to queue
    Returns Job instance or None if job already exists
    """
    try:
        job_id = f"analytics-{session_id}"
        
        # Check if job already exists
        try:
            existing_job = Job.fetch(job_id, connection=get_redis_connection())
            state = existing_job.get_status()
            
            # If job is queued, started, or finished recently, don't create duplicate
            if state in ['queued', 'started']:
                if os.getenv('DEBUG_ANALYTICS', 'false').lower() == 'true':
                    print(f"⏭️  Skipping duplicate job for session {session_id} (state: {state})")
                return existing_job
            
            # If job completed recently (within last 30 seconds), don't recreate
            if state == 'finished' and existing_job.ended_at:
                from datetime import datetime, timedelta
                time_since_completion = (datetime.now() - existing_job.ended_at).total_seconds()
                if time_since_completion < 30:
                    if os.getenv('DEBUG_ANALYTICS', 'false').lower() == 'true':
                        print(f"⏭️  Skipping job for session {session_id} (completed {int(time_since_completion)}s ago)")
                    return existing_job
        except Exception:
            # Job doesn't exist, continue to create new one
            pass
        
        # Add job with idempotent jobId
        job = analytics_queue.enqueue(
            compute_all_analytics,
            session_id,
            filters,
            job_id=job_id,
            job_timeout='10m',  # 10 minute timeout
            result_ttl=3600,  # Keep results for 1 hour
            failure_ttl=86400,  # Keep failures for 24 hours
        )
        
        print(f"📋 Analytics computation job queued: {job.id} for session {session_id}")
        return job
    except Exception as e:
        print(f"Error enqueueing analytics job: {e}")
        raise


def get_job_status(session_id: str) -> Optional[Dict[str, Any]]:
    """Get job status by session ID"""
    try:
        job_id = f"analytics-{session_id}"
        job = Job.fetch(job_id, connection=get_redis_connection())
        
        return {
            'id': job.id,
            'status': job.get_status(),
            'result': job.result,
            'exc_info': job.exc_info,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'ended_at': job.ended_at.isoformat() if job.ended_at else None,
        }
    except Exception:
        return None


def get_queue_stats() -> Dict[str, int]:
    """Get queue statistics"""
    try:
        queue = Queue('analytics-computation', connection=get_redis_connection())
        return {
            'waiting': len(queue),
            'started': len(queue.started_job_registry),
            'finished': len(queue.finished_job_registry),
            'failed': len(queue.failed_job_registry),
        }
    except Exception as e:
        print(f"Error getting queue stats: {e}")
        return {
            'waiting': 0,
            'started': 0,
            'finished': 0,
            'failed': 0,
        }


def remove_job(session_id: str) -> None:
    """Remove job by session ID"""
    try:
        job_id = f"analytics-{session_id}"
        job = Job.fetch(job_id, connection=get_redis_connection())
        job.delete()
        print(f"🗑️ Removed job for session {session_id}")
    except Exception:
        pass
