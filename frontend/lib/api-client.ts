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
    // Use Next.js API route instead of direct backend call
    const url = `/api/analytics/${endpoint}?${queryString}`
    
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
    
    const responseData = await response.json()
    
    // Backend returns { success, data, count, ... } - extract the data
    // Handle both wrapped response and direct array response
    const actualData = responseData.data !== undefined ? responseData.data : responseData
    return {
      success: responseData.success !== undefined ? responseData.success : true,
      data: actualData as T,
      count: responseData.count || (Array.isArray(actualData) ? actualData.length : 1),
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
    // Use Next.js API route instead of direct backend call
    const url = `/api/analytics/compute${asyncMode ? '?async_mode=true' : ''}`
    
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
    console.log('[API Client] Initiating login request to /api/login')
    
    // Use Next.js API route instead of direct Python backend call to avoid CORS issues
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    
    console.log('[API Client] Login response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
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
    console.error('[API Client] Error logging in:', error)
    console.error('[API Client] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    
    // Handle specific error types
    if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      return {
        success: false,
        error: 'Cannot connect to the server. Please check if the frontend server is running and the API route is accessible.',
      }
    }
    
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
    // Use Next.js API route instead of direct backend call
    const response = await fetch('/api/stats')
    
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
  message?: string
  folderId?: string
}>> {
  try {
    // Use Next.js API route instead of direct backend call
    const url = folderId
      ? `/api/google-drive/files?folderId=${encodeURIComponent(folderId)}`
      : `/api/google-drive/files`
    
    console.log('[API Client] Fetching Google Drive files from:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { detail: `HTTP ${response.status}: ${response.statusText}` }
      }
      
      console.error('[API Client] Error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      })
      
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    console.log('[API Client] Successfully fetched files:', { 
      fileCount: data.files?.length || 0,
      hasMessage: !!data.message 
    })
    
    return {
      success: data.success || true,
      data: {
        files: data.files || [],
        message: data.message,
        folderId: data.folderId,
      },
    }
  } catch (error: any) {
    console.error('[API Client] Error listing Google Drive files:', error)
    console.error('[API Client] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Network error'
    
    if (error.message?.includes('Failed to fetch')) {
      errorMessage = 'Failed to connect to the server. Please ensure:\n' +
        '1. The frontend development server is running\n' +
        '2. The backend server is running at http://localhost:8000\n' +
        '3. There are no network connectivity issues'
    }
    
    return {
      success: false,
      error: errorMessage,
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
  // Create AbortController for timeout (5 minutes + 30 seconds buffer)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 330000) // 5.5 minutes
  
  try {
    // Use Next.js API route to proxy to Python backend
    const response = await fetch('/api/google-drive/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, sheetType }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return {
        success: false,
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }
    }
    
    const data = await response.json()
    
    // Ensure sessionId is present in the response
    if (!data.sessionId && data.success) {
      console.warn('Warning: sessionId not found in response from backend')
    }
    
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
    clearTimeout(timeoutId)
    console.error('Error reading Google Drive file:', error)
    
    // Handle timeout specifically
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        success: false,
        error: 'Request timed out. The file might be too large. Please try again or contact support.',
      }
    }
    
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
    // Use Next.js API route instead of direct backend call
    const response = await fetch('/api/google-drive/auth')
    
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
      if (filters.endDate) queryParams.append('endDate', filters.endDate)
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
    
    // Use Next.js API route instead of direct backend call
    const response = await fetch(`/api/analytics/raw-shipping?${queryParams.toString()}`)
    
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
    
    const responseData = await response.json()
    // Backend returns { success, data, count, total, ... } - extract the data array
    const dataArray = responseData.data || (Array.isArray(responseData) ? responseData : [])
    return {
      success: responseData.success !== undefined ? responseData.success : true,
      data: dataArray,
      count: responseData.count || (Array.isArray(dataArray) ? dataArray.length : 0),
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
  skusTop10: string[]
  productNames: string[]
  productNamesTop10: string[]
  statuses: string[]
}>> {
  try {
    // Use Next.js API route instead of direct backend call
    const response = await fetch(`/api/analytics/filter-options?sessionId=${encodeURIComponent(sessionId)}`)
    
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
        skusTop10: data.skusTop10 || [],
        productNames: data.productNames || [],
        productNamesTop10: data.productNamesTop10 || [],
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

