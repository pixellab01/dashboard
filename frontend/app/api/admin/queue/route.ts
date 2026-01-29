import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/admin/queue
 * Proxy admin queue request to Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    const response = await proxyToPythonBackend('/api/admin/queue', {
      method: 'GET',
      queryParams: sessionId ? { sessionId } : undefined,
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error fetching queue stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch queue stats',
      },
      { status: 500 }
    )
  }
}
