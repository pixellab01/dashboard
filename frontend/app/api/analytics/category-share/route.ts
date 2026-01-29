import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsFromRedis, isSourceDataValid } from '@/lib/redis'
import { FilterParams } from '@/lib/analytics'

/**
 * GET /api/analytics/category-share
 * 
 * Get category share analytics from Redis (with optional filters)
 * Returns empty if source data has expired
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

    const filters: FilterParams = {
      startDate: searchParams.get('startDate') || null,
      endDate: searchParams.get('endDate') || null,
      orderStatus: searchParams.get('orderStatus') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      channel: searchParams.get('channel') || undefined,
      sku: searchParams.getAll('sku').length > 0 ? searchParams.getAll('sku') : undefined,
      productName: searchParams.getAll('productName').length > 0 ? searchParams.getAll('productName') : undefined,
    }

    const filterKey = JSON.stringify(filters)
    
    // Read-only: Only fetch from Redis, no on-demand computation
    const data = await getAnalyticsFromRedis(sessionId, `category-share:${filterKey}`)

    // Return empty array if not found (worker should compute it)
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
    console.error('Error fetching category share:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch category share',
      },
      { status: 500 }
    )
  }
}
