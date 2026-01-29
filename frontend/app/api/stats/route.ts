import { NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/stats
 * Proxy stats request to Python backend
 */
export async function GET() {
  try {
    const response = await proxyToPythonBackend('/api/stats', {
      method: 'GET',
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch stats' 
      },
      { status: 500 }
    )
  }
}
