import { NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/health
 * Health check endpoint to verify backend connection
 */
export async function GET() {
  try {
    console.log('[Health Check] Testing backend connection...')
    
    const response = await proxyToPythonBackend('/', {
      method: 'GET',
      timeout: 5000,
    })
    
    const data = await response.json().catch(() => ({ status: 'unknown' }))
    
    return NextResponse.json({
      success: true,
      frontend: 'ok',
      backend: {
        connected: response.ok,
        status: response.status,
        data,
      },
    })
  } catch (error: any) {
    console.error('[Health Check] Error:', error)
    return NextResponse.json({
      success: false,
      frontend: 'ok',
      backend: {
        connected: false,
        error: error.message,
      },
    }, { status: 503 })
  }
}
