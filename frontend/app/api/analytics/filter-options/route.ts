import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/analytics/filter-options
 * Proxy filter options request to Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const channel = searchParams.get('channel')
    const sku = searchParams.get('sku')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const queryParams: Record<string, string> = { sessionId }
    if (channel) queryParams.channel = channel
    if (sku) queryParams.sku = sku

    const response = await proxyToPythonBackend('/api/analytics/filter-options', {
      method: 'GET',
      queryParams,
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch filter options',
      },
      { status: 500 }
    )
  }
}
