import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/analytics/order-status-filter
 * Get unique order statuses for filter dropdown from dataframe
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const response = await proxyToPythonBackend('/api/analytics/order-status-filter', {
      method: 'GET',
      queryParams: {
        sessionId,
      },
    })

    const data = await response.json()

    // Handle 404 as empty data
    if (response.status === 404) {
      return NextResponse.json(
        {
          success: true,
          statuses: [],
          count: 0,
          message: 'No data found for this session. Please read the shipping file first.',
        },
        { status: 200 }
      )
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error fetching order status filter:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch order status filter',
        statuses: [],
        count: 0,
      },
      { status: 500 }
    )
  }
}
