/**
 * Redis Client Configuration
 */

import Redis from 'ioredis'

let redis: Redis | null = null

// TTL Constants - All data expires at same time
const TTL_SECONDS = 1800  // 30 minutes - SAME FOR ALL DATA

export function getRedisClient(): Redis {
  if (redis) {
    return redis
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
  })

  redis.on('error', (err) => {
    console.error('Redis Client Error:', err)
  })

  redis.on('connect', () => {
    console.log('Redis Client Connected')
  })

  return redis
}

/**
 * Save shipping data to Redis with 30 minute TTL
 */
export async function saveShippingDataToRedis(data: any[], sessionId: string): Promise<void> {
  const client = getRedisClient()
  const key = `shipping:data:${sessionId}`
  
  // Save data as JSON string with TTL_SECONDS
  await client.setex(key, TTL_SECONDS, JSON.stringify(data))
  
  // Also save metadata with same TTL
  const metadataKey = `shipping:meta:${sessionId}`
  const metadata = {
    totalRows: data.length,
    timestamp: new Date().toISOString(),
    sessionId,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  }
  await client.setex(metadataKey, TTL_SECONDS, JSON.stringify(metadata))
}

/**
 * Get shipping data from Redis
 */
export async function getShippingDataFromRedis(sessionId: string): Promise<any[] | null> {
  const client = getRedisClient()
  const key = `shipping:data:${sessionId}`
  
  const data = await client.get(key)
  if (!data) {
    return null
  }
  
  return JSON.parse(data)
}

/**
 * Get shipping metadata from Redis
 */
export async function getShippingMetadataFromRedis(sessionId: string): Promise<any | null> {
  const client = getRedisClient()
  const key = `shipping:meta:${sessionId}`
  
  const data = await client.get(key)
  if (!data) {
    return null
  }
  
  return JSON.parse(data)
}

/**
 * Save computed analytics to Redis with same TTL as shipping data
 */
export async function saveAnalyticsToRedis(sessionId: string, analyticsType: string, data: any): Promise<void> {
  const client = getRedisClient()
  const key = `analytics:${analyticsType}:${sessionId}`
  
  // Use same TTL_SECONDS for all analytics
  await client.setex(key, TTL_SECONDS, JSON.stringify(data))
}

/**
 * Get computed analytics from Redis
 */
export async function getAnalyticsFromRedis(sessionId: string, analyticsType: string): Promise<any | null> {
  const client = getRedisClient()
  const key = `analytics:${analyticsType}:${sessionId}`
  
  const data = await client.get(key)
  if (!data) {
    return null
  }
  
  return JSON.parse(data)
}

/**
 * Get remaining TTL (in seconds) for a key
 */
export async function getKeyTTL(key: string): Promise<number> {
  const client = getRedisClient()
  const ttl = await client.ttl(key)
  return ttl // Returns -1 if key doesn't exist, -2 if key exists but has no TTL
}

/**
 * Get remaining TTL for shipping data
 */
export async function getShippingDataTTL(sessionId: string): Promise<number> {
  const key = `shipping:data:${sessionId}`
  return await getKeyTTL(key)
}

/**
 * Get remaining TTL for analytics data
 */
export async function getAnalyticsDataTTL(sessionId: string, analyticsType: string): Promise<number> {
  const key = `analytics:${analyticsType}:${sessionId}`
  return await getKeyTTL(key)
}

/**
 * Check if session data is still valid (has TTL > 0)
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const ttl = await getShippingDataTTL(sessionId)
  return ttl > 0
}

/**
 * Get TTL info for session and analytics (for UI display)
 */
export async function getSessionTTLInfo(sessionId: string): Promise<{
  shipping: { ttl: number; expiresAt: string | null }
  analytics: { [key: string]: { ttl: number; expiresAt: string | null } }
}> {
  const client = getRedisClient()
  const keys = await client.keys(`analytics:*:${sessionId}`)
  
  const shippingTTL = await getShippingDataTTL(sessionId)
  const analyticsTTL: { [key: string]: { ttl: number; expiresAt: string | null } } = {}
  
  for (const key of keys) {
    const ttl = await getKeyTTL(key)
    const analyticsType = key.split(':')[1]
    
    analyticsTTL[analyticsType] = {
      ttl,
      expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
    }
  }
  
  return {
    shipping: {
      ttl: shippingTTL,
      expiresAt: shippingTTL > 0 ? new Date(Date.now() + shippingTTL * 1000).toISOString() : null,
    },
    analytics: analyticsTTL,
  }
}

/**
 * Check if source data exists - if not, analytics are invalid
 */
export async function isSourceDataValid(sessionId: string): Promise<boolean> {
  const shippingData = await getShippingDataFromRedis(sessionId)
  return shippingData !== null && shippingData.length > 0
}

/**
 * Get analytics only if source data is still valid
 */
export async function getValidatedAnalytics(sessionId: string, analyticsType: string): Promise<any | null> {
  // First check if source data exists
  const isValid = await isSourceDataValid(sessionId)
  if (!isValid) {
    console.warn(`[Analytics Validation] Source data expired for session ${sessionId}. Returning null.`)
    return null
  }
  
  // If source data exists, return analytics
  return await getAnalyticsFromRedis(sessionId, analyticsType)
}

/**
 * Get TTL Constants
 */
export function getTTLSeconds(): number {
  return TTL_SECONDS
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
