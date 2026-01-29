"""
RQ Worker for Processing Analytics Jobs
Run this as a separate process to process queued analytics jobs
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from redis import Redis
from rq import Worker, Queue, Connection
from backend.config import REDIS_URL
from backend.rq_queue import get_redis_connection


def main():
    """Main worker function"""
    redis_conn = get_redis_connection()
    
    # Create queues
    queues = [Queue('analytics-computation', connection=redis_conn)]
    
    # Create worker
    worker = Worker(queues, connection=redis_conn, name='analytics-worker')
    
    print('🚀 Analytics worker started and listening for jobs...')
    print(f'   Queues: {[q.name for q in queues]}')
    print(f'   Redis: {REDIS_URL}')
    
    # Start worker
    worker.work()


if __name__ == '__main__':
    main()
