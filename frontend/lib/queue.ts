/**
 * BullMQ Queue Configuration
 * 
 * Queue for analytics computation jobs
 */

import { Queue, QueueOptions } from 'bullmq'

// Parse Redis URL to get connection details
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  
  try {
    // Parse Redis URL
    const url = new URL(redisUrl)
    
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      db: url.pathname && url.pathname.length > 1 ? parseInt(url.pathname.slice(1)) : undefined,
    }
  } catch (error) {
    // Fallback if URL parsing fails (e.g., simple host:port format)
    console.warn('Failed to parse REDIS_URL, using defaults:', error)
    return {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: undefined,
    }
  }
}

const connection = getRedisConnection()

// Analytics computation queue configuration
const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s delay, exponential backoff
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for debugging
    },
  },
}

// Create analytics computation queue
export const analyticsQueue = new Queue('analytics-computation', queueOptions)

/**
 * Add analytics computation job to queue (with idempotency check)
 * @param sessionId - Session ID for the data
 * @param priority - Job priority (higher = processed first, default: 10)
 * @returns Job instance or null if job already exists/processing
 */
export async function enqueueAnalyticsComputation(
  sessionId: string,
  priority: number = 10
) {
  try {
    const jobId = `analytics-${sessionId}`
    
    // Check if job already exists (waiting, active, or recently completed)
    const existingJob = await analyticsQueue.getJob(jobId)
    if (existingJob) {
      const state = await existingJob.getState()
      // If job is waiting, active, or delayed, don't create duplicate
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        if (process.env.DEBUG_ANALYTICS === 'true') {
          console.log(`⏭️  Skipping duplicate job for session ${sessionId} (state: ${state})`)
        }
        return existingJob
      }
      // If job completed recently (within last 30 seconds), don't recreate
      if (state === 'completed' && existingJob.finishedOn) {
        const timeSinceCompletion = Date.now() - existingJob.finishedOn
        if (timeSinceCompletion < 30000) { // 30 seconds
          if (process.env.DEBUG_ANALYTICS === 'true') {
            console.log(`⏭️  Skipping job for session ${sessionId} (completed ${Math.round(timeSinceCompletion / 1000)}s ago)`)
          }
          return existingJob
        }
      }
    }
    
    // Add job with idempotent jobId
    const job = await analyticsQueue.add(
      'compute-analytics',
      { sessionId },
      {
        priority, // Higher priority = processed first
        jobId, // Prevent duplicate jobs for same session
      }
    )
    
    console.log(`📋 Analytics computation job queued: ${job.id} for session ${sessionId}`)
    return job
  } catch (error) {
    console.error('Error enqueueing analytics job:', error)
    throw error
  }
}

/**
 * Get job status by session ID
 * @param sessionId - Session ID
 * @returns Job status or null if not found
 */
export async function getJobStatus(sessionId: string) {
  try {
    const job = await analyticsQueue.getJob(`analytics-${sessionId}`)
    if (!job) return null
    
    const state = await job.getState()
    
    return {
      id: job.id,
      state,
      progress: job.progress || 0,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }
  } catch (error) {
    console.error('Error getting job status:', error)
    return null
  }
}

/**
 * Get queue statistics
 * @returns Queue stats
 */
export async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      analyticsQueue.getWaitingCount(),
      analyticsQueue.getActiveCount(),
      analyticsQueue.getCompletedCount(),
      analyticsQueue.getFailedCount(),
      analyticsQueue.getDelayedCount(),
    ])
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    }
  } catch (error) {
    console.error('Error getting queue stats:', error)
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    }
  }
}

/**
 * Remove job by session ID
 * @param sessionId - Session ID
 */
export async function removeJob(sessionId: string) {
  try {
    const job = await analyticsQueue.getJob(`analytics-${sessionId}`)
    if (job) {
      await job.remove()
      console.log(`🗑️ Removed job for session ${sessionId}`)
    }
  } catch (error) {
    console.error('Error removing job:', error)
  }
}
