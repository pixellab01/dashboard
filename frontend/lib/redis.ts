/**
 * Redis Client Configuration
 */

import Redis from 'ioredis'

// TTL Constants - All data expires at same time
const TTL_SECONDS = 1800  // 30 minutes - SAME FOR ALL DATA

// Use globalThis to ensure singleton across Next.js hot reloads
declare global {
  var __redisClient: Redis | undefined
}

export function getRedisClient(): Redis {
  // Use globalThis to persist across hot reloads in dev mode
  if (globalThis.__redisClient) {
    return globalThis.__redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    lazyConnect: false,
  })

  client.on('error', (err) => {
    console.error('Redis Client Error:', err)
  })

  // Only log connection once
  let hasLoggedConnection = false
  client.on('connect', () => {
    if (!hasLoggedConnection) {
      console.log('Redis Client Connected')
      hasLoggedConnection = true
    }
  })

  // Store in globalThis for Next.js dev mode persistence
  globalThis.__redisClient = client

  return client
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
 * @param sessionId - Session ID
 * @param analyticsType - Analytics type (can be full key path like "base:weekly-summary" or just "weekly-summary")
 * @param data - Data to save
 */
export async function saveAnalyticsToRedis(sessionId: string, analyticsType: string, data: any): Promise<void> {
  const client = getRedisClient()
  let key: string
  
  if (analyticsType.startsWith('analytics:')) {
    // Full key already provided
    key = analyticsType
  } else if (analyticsType.includes(':')) {
    // New format: base:weekly-summary -> analytics:sessionId:base:weekly-summary
    key = `analytics:${sessionId}:${analyticsType}`
  } else {
    // Old format: weekly-summary -> analytics:weekly-summary:sessionId (backward compat)
    key = `analytics:${analyticsType}:${sessionId}`
  }
  
  // Use same TTL_SECONDS for all analytics
  await client.setex(key, TTL_SECONDS, JSON.stringify(data))
}

/**
 * Get computed analytics from Redis
 * @param sessionId - Session ID
 * @param analyticsType - Analytics type (can be full key path like "base:weekly-summary" or just "weekly-summary")
 */
export async function getAnalyticsFromRedis(sessionId: string, analyticsType: string): Promise<any | null> {
  const client = getRedisClient()
  // Support both old format (analyticsType:sessionId) and new format (sessionId:analyticsType)
  let key: string
  if (analyticsType.includes(':')) {
    // New format: analytics:sessionId:base:weekly-summary
    key = analyticsType.startsWith('analytics:') ? analyticsType : `analytics:${analyticsType}`
  } else {
    // Old format: analytics:weekly-summary:sessionId
    key = `analytics:${analyticsType}:${sessionId}`
  }
  
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

/**
 * Set a lock in Redis (for idempotency)
 * @param key - Lock key
 * @param ttlSeconds - TTL in seconds (default: 300 = 5 minutes)
 * @returns true if lock was acquired, false if already locked
 */
export async function acquireLock(key: string, ttlSeconds: number = 300): Promise<boolean> {
  const client = getRedisClient()
  const lockKey = `lock:${key}`
  const result = await client.set(lockKey, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

/**
 * Release a lock in Redis
 * @param key - Lock key
 */
export async function releaseLock(key: string): Promise<void> {
  const client = getRedisClient()
  const lockKey = `lock:${key}`
  await client.del(lockKey)
}

/**
 * Build Redis key for analytics based on filters
 * Format: analytics:{sessionId}:{filterPath}:{analyticsType}
 * Example: analytics:session123:base:weekly-summary
 * Example: analytics:session123:channel:Shopify_4:weekly-summary
 * Example: analytics:session123:channel:Shopify_4:sku:Pasandida-Aurat-02:weekly-summary
 */
export function buildAnalyticsKey(sessionId: string, analyticsType: string, filters?: {
  channel?: string
  sku?: string | string[]
  productName?: string | string[]
  startDate?: string | null
  endDate?: string | null
  orderStatus?: string
  paymentMethod?: string
}): string {
  if (!filters || (!filters.channel && !filters.sku && !filters.productName && !filters.startDate && !filters.endDate && !filters.orderStatus && !filters.paymentMethod)) {
    return `analytics:${sessionId}:base:${analyticsType}`
  }

  const parts: string[] = [sessionId]

  if (filters.channel) {
    parts.push(`channel:${filters.channel}`)
  }

  if (filters.sku) {
    const skuValue = Array.isArray(filters.sku) ? filters.sku[0] : filters.sku
    parts.push(`sku:${skuValue}`)
  }

  if (filters.productName) {
    const productValue = Array.isArray(filters.productName) ? filters.productName[0] : filters.productName
    parts.push(`product:${productValue}`)
  }

  // For date/status/payment filters, use a hash of the filter combination
  const otherFilters: string[] = []
  if (filters.startDate) otherFilters.push(`start:${filters.startDate}`)
  if (filters.endDate) otherFilters.push(`end:${filters.endDate}`)
  if (filters.orderStatus) otherFilters.push(`status:${filters.orderStatus}`)
  if (filters.paymentMethod) otherFilters.push(`payment:${filters.paymentMethod}`)

  if (otherFilters.length > 0) {
    // Use a short hash for complex filter combinations
    const filterHash = Buffer.from(otherFilters.join('|')).toString('base64').slice(0, 16)
    parts.push(`filters:${filterHash}`)
  }

  return `analytics:${parts.join(':')}:${analyticsType}`
}

/**
 * Get analytics with proper key building from filters
 */
export async function getAnalyticsByFilters(
  sessionId: string,
  analyticsType: string,
  filters?: {
    channel?: string
    sku?: string | string[]
    productName?: string | string[]
    startDate?: string | null
    endDate?: string | null
    orderStatus?: string
    paymentMethod?: string
  }
): Promise<any | null> {
  const key = buildAnalyticsKey(sessionId, analyticsType, filters)
  const client = getRedisClient()
  const data = await client.get(key)
  if (!data) {
    return null
  }
  return JSON.parse(data)
}
