/**
 * API Client for Python Backend
 * Centralized functions for making API calls to the Python backend
 */

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  count?: number
}

/**
 * Build query string from filter parameters
 */
export function buildQueryString(params: {
  sessionId: string
  startDate?: string | null
  endDate?: string | null
  orderStatus?: string
  paymentMethod?: string
  channel?: string
  sku?: string | string[]
  productName?: string | string[]
}): string {
  const searchParams = new URLSearchParams()
  searchParams.append('sessionId', params.sessionId)
  
  if (params.startDate) searchParams.append('startDate', params.startDate)
  if (params.endDate) searchParams.append('endDate', params.endDate)
  if (params.orderStatus && params.orderStatus !== 'All') {
    searchParams.append('orderStatus', params.orderStatus)
  }
  if (params.paymentMethod && params.paymentMethod !== 'All') {
    searchParams.append('paymentMethod', params.paymentMethod)
  }
  if (params.channel && params.channel !== 'All') {
    searchParams.append('channel', params.channel)
  }
  if (params.sku && params.sku !== 'All') {
    const skuArray = Array.isArray(params.sku) ? params.sku : [params.sku]
    skuArray.forEach(sku => searchParams.append('sku', sku))
  }
  if (params.productName && params.productName !== 'All') {
    const productNameArray = Array.isArray(params.productName) ? params.productName : [params.productName]
    productNameArray.forEach(productName => searchParams.append('productName', productName))
  }
  
  return searchParams.toString()
}

/**
 * Fetch analytics data from Python backend
 * Wraps the response to match frontend expectations
 */
export async function fetchAnalytics<T>(
  endpoint: string,
  params: {
    sessionId: string
    startDate?: string | null
    endDate?: string | null
    orderStatus?: string
    paymentMethod?: string
    channel?: string
    sku?: string | string[]
    productName?: string | string[]
  }
): Promise<ApiResponse<T>> {
  try {
    const queryString = buildQueryString(params)
    const url = `${PYTHON_API_URL}/api/analytics/${endpoint}?${queryString}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 404) {
        // Analytics not found - return empty data
        return {
          success: true,
          data: [] as T,
          count: 0,
        }
      }
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    
    // Python backend returns data directly (array or object)
    // Wrap it to match frontend expectations
    return {
      success: true,
      data: Array.isArray(data) ? data : data,
      count: Array.isArray(data) ? data.length : 1,
    }
  } catch (error: any) {
    console.error(`Error fetching ${endpoint}:`, error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Compute analytics via Python backend
 */
export async function computeAnalytics(
  sessionId: string,
  filters?: {
    startDate?: string | null
    endDate?: string | null
    orderStatus?: string
    paymentMethod?: string
    channel?: string
    sku?: string | string[]
    productName?: string | string[]
  },
  asyncMode: boolean = false
): Promise<ApiResponse<{ sessionId: string; jobId?: string }>> {
  try {
    const url = `${PYTHON_API_URL}/api/analytics/compute${asyncMode ? '?async_mode=true' : ''}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        filters: filters || undefined,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    
    return {
      success: data.success || true,
      data: {
        sessionId: data.sessionId || sessionId,
        jobId: data.jobId,
      },
      error: data.error,
    }
  } catch (error: any) {
    console.error('Error computing analytics:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Generate a new session ID
 */
export async function generateSessionId(): Promise<string> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/session/generate`, {
      method: 'POST',
    })
    
    if (!response.ok) {
      throw new Error('Failed to generate session ID')
    }
    
    const data = await response.json()
    return data.sessionId
  } catch (error: any) {
    console.error('Error generating session ID:', error)
    // Fallback: generate client-side session ID
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<ApiResponse<{ user: any; message: string }>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: data.success || true,
      data: {
        user: data.user,
        message: data.message,
      },
    }
  } catch (error: any) {
    console.error('Error logging in:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get dashboard stats
 */
export async function getStats(): Promise<ApiResponse<{ totalUsers: number; message: string }>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/stats`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: data.success || true,
      data: {
        totalUsers: data.totalUsers,
        message: data.message,
      },
    }
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get session stats
 */
export async function getSessionStats(sessionId: string): Promise<ApiResponse<{
  sessionId: string
  isValid: boolean
  ttl: number
  metadata: any
}>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/stats/session?sessionId=${encodeURIComponent(sessionId)}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        isValid: data.isValid,
        ttl: data.ttl,
        metadata: data.metadata,
      },
    }
  } catch (error: any) {
    console.error('Error fetching session stats:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * List Google Drive files
 */
export async function listGoogleDriveFiles(folderId?: string): Promise<ApiResponse<{
  files: Array<{
    id: string
    name: string
    mimeType: string
    modifiedTime: string
  }>
}>> {
  try {
    const url = folderId
      ? `${PYTHON_API_URL}/api/google-drive/files?folderId=${encodeURIComponent(folderId)}`
      : `${PYTHON_API_URL}/api/google-drive/files`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: data.success || true,
      data: {
        files: data.files || [],
      },
    }
  } catch (error: any) {
    console.error('Error listing Google Drive files:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Read Google Drive file
 */
export async function readGoogleDriveFile(
  fileId: string,
  sheetType: string = 'shipping'
): Promise<ApiResponse<{
  fileName: string
  totalRows: number
  originalRows: number
  duplicatesRemoved: number
  headers: string[]
  totalColumns: number
  sessionId: string
  sheetType: string
  message: string
}>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/google-drive/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, sheetType }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: data.success || true,
      data: {
        fileName: data.fileName,
        totalRows: data.totalRows,
        originalRows: data.originalRows,
        duplicatesRemoved: data.duplicatesRemoved,
        headers: data.headers,
        totalColumns: data.totalColumns,
        sessionId: data.sessionId,
        sheetType: data.sheetType,
        message: data.message,
      },
    }
  } catch (error: any) {
    console.error('Error reading Google Drive file:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get Google Drive auth URL
 */
export async function getGoogleDriveAuthUrl(): Promise<ApiResponse<{
  authUrl: string
  redirectUri: string
  message: string
  instructions: string
}>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/google-drive/auth`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: data.success || true,
      data: {
        authUrl: data.authUrl,
        redirectUri: data.redirectUri,
        message: data.message,
        instructions: data.instructions,
      },
    }
  } catch (error: any) {
    console.error('Error getting Google Drive auth URL:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get raw shipping data
 */
export async function getRawShippingData(
  sessionId: string,
  filters?: {
    startDate?: string | null
    endDate?: string | null
    orderStatus?: string
    paymentMethod?: string
    channel?: string
    sku?: string | string[]
    productName?: string | string[]
  },
  limit?: string | number
): Promise<ApiResponse<any[]>> {
  try {
    const queryParams = new URLSearchParams()
    queryParams.append('sessionId', sessionId)
    
    if (filters) {
      if (filters.startDate) queryParams.append('startDate', filters.startDate)
      if (filters.endDate) queryParams.append('filters.endDate', filters.endDate)
      if (filters.orderStatus && filters.orderStatus !== 'All') {
        queryParams.append('orderStatus', filters.orderStatus)
      }
      if (filters.paymentMethod && filters.paymentMethod !== 'All') {
        queryParams.append('paymentMethod', filters.paymentMethod)
      }
      if (filters.channel && filters.channel !== 'All') {
        queryParams.append('channel', filters.channel)
      }
      if (filters.sku && filters.sku !== 'All') {
        const skuArray = Array.isArray(filters.sku) ? filters.sku : [filters.sku]
        skuArray.forEach(sku => queryParams.append('sku', sku))
      }
      if (filters.productName && filters.productName !== 'All') {
        const productNameArray = Array.isArray(filters.productName) ? filters.productName : [filters.productName]
        productNameArray.forEach(productName => queryParams.append('productName', productName))
      }
    }
    
    if (limit) {
      queryParams.append('limit', String(limit))
    }
    
    const response = await fetch(`${PYTHON_API_URL}/api/analytics/raw-shipping?${queryParams.toString()}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          data: [],
          count: 0,
        }
      }
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      data: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
    }
  } catch (error: any) {
    console.error('Error fetching raw shipping data:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get filter options (channels, SKUs, product names, etc.)
 */
export async function getFilterOptions(sessionId: string): Promise<ApiResponse<{
  channels: string[]
  skus: string[]
  productNames: string[]
  statuses: string[]
}>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/analytics/filter-options?sessionId=${encodeURIComponent(sessionId)}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      data: {
        channels: data.channels || [],
        skus: data.skus || [],
        productNames: data.productNames || [],
        statuses: data.statuses || [],
      },
    }
  } catch (error: any) {
    console.error('Error fetching filter options:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}

/**
 * Get TTL info for analytics data
 */
export async function getTtlInfo(sessionId: string): Promise<ApiResponse<{
  shipping: { ttl: number; expiresAt: string | null }
  analytics: { [key: string]: { ttl: number; expiresAt: string | null } }
}>> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/analytics/ttl-info?sessionId=${encodeURIComponent(sessionId)}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      data: {
        shipping: data.shipping || { ttl: 0, expiresAt: null },
        analytics: data.analytics || {},
      },
    }
  } catch (error: any) {
    console.error('Error fetching TTL info:', error)
    return {
      success: false,
      error: error.message || 'Network error',
    }
  }
}
