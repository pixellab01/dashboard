import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsByFilters, isSourceDataValid, buildAnalyticsKey } from '@/lib/redis'

/**
 * GET /api/analytics/weekly-summary
 * 
 * Read-only: Fetch precomputed analytics from Redis
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

    // Check if source data is still valid
    const sourceValid = await isSourceDataValid(sessionId)
    if (!sourceValid) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          count: 0,
          error: 'Source data has expired. Please read the shipping file again.',
        },
        { status: 200 }
      )
    }

    // Extract filter parameters
    const filters = {
      startDate: searchParams.get('startDate') || null,
      endDate: searchParams.get('endDate') || null,
      orderStatus: searchParams.get('orderStatus') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      channel: searchParams.get('channel') || undefined,
      sku: searchParams.getAll('sku').length > 0 ? searchParams.getAll('sku') : undefined,
      productName: searchParams.getAll('productName').length > 0 ? searchParams.getAll('productName') : undefined,
    }

    // Build key and fetch from Redis (read-only)
    const key = buildAnalyticsKey(sessionId, 'weekly-summary', filters)
    const data = await getAnalyticsByFilters(sessionId, 'weekly-summary', filters)

    // Return empty if not found (worker should compute it)
    if (!data) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          count: 0,
          message: 'Analytics not yet computed. Please wait for the worker to process.',
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: Array.isArray(data) ? data : [],
        count: Array.isArray(data) ? data.length : 0,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching weekly summary:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch weekly summary',
      },
      { status: 500 }
    )
  }
}
