/**
 * Analytics Worker
 * 
 * Worker process that processes analytics computation jobs from the queue
 */

import { Worker, Job } from 'bullmq'
import { computeAllAnalytics } from '../analytics'

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

// Worker configuration
const workerOptions = {
  connection,
  concurrency: 2, // Process 2 jobs in parallel
  limiter: {
    max: 5, // Max 5 jobs per
    duration: 1000, // 1 second (rate limiting)
  },
}

// Create worker
export const analyticsWorker = new Worker(
  'analytics-computation',
  async (job: Job) => {
    const { sessionId } = job.data
    
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    
    console.log(`🔄 [Worker] Processing analytics computation for session: ${sessionId}`)
    
    try {
      // Update progress
      await job.updateProgress(10)
      
      // Compute analytics
      const result = await computeAllAnalytics(sessionId)
      
      await job.updateProgress(90)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to compute analytics')
      }
      
      await job.updateProgress(100)
      
      console.log(`✅ [Worker] Analytics computed successfully for session: ${sessionId}`)
      
      return {
        success: true,
        sessionId,
        computedAt: new Date().toISOString(),
      }
    } catch (error: any) {
      console.error(`❌ [Worker] Error computing analytics for session ${sessionId}:`, error.message)
      throw error // Re-throw to trigger retry mechanism
    }
  },
  workerOptions
)

// Worker event handlers
analyticsWorker.on('completed', (job) => {
  console.log(`✅ [Worker] Job ${job.id} completed successfully`)
})

analyticsWorker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} failed:`, err.message)
  if (job) {
    console.error(`   Session ID: ${job.data.sessionId}`)
    console.error(`   Attempt: ${job.attemptsMade}/${job.opts.attempts}`)
  }
})

analyticsWorker.on('error', (err) => {
  console.error('❌ [Worker] Worker error:', err)
})

analyticsWorker.on('stalled', (jobId) => {
  console.warn(`⚠️ [Worker] Job ${jobId} stalled`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 [Worker] SIGTERM received, shutting down gracefully...')
  await analyticsWorker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 [Worker] SIGINT received, shutting down gracefully...')
  await analyticsWorker.close()
  process.exit(0)
})

console.log('🚀 [Worker] Analytics worker started and listening for jobs...')
console.log(`   Concurrency: ${workerOptions.concurrency}`)
console.log(`   Rate limit: ${workerOptions.limiter.max} jobs per ${workerOptions.limiter.duration}ms`)
