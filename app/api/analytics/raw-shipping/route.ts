import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * GET /api/analytics/raw-shipping
 * 
 * Get raw filtered shipping data for client-side aggregation
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

    const data = await getShippingDataFromRedis(sessionId)

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No data found',
        },
        { status: 404 }
      )
    }

    // Extract filter parameters
    const filters: FilterParams = {
      startDate: searchParams.get('startDate') || null,
      endDate: searchParams.get('endDate') || null,
      orderStatus: searchParams.get('orderStatus') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      channel: searchParams.get('channel') || undefined,
      sku: searchParams.getAll('sku').length > 0 ? searchParams.getAll('sku') : undefined,
      productName: searchParams.getAll('productName').length > 0 ? searchParams.getAll('productName') : undefined,
    }

    // Apply filters
    const filteredData = filterShippingData(data, filters)

    return NextResponse.json(
      {
        success: true,
        data: filteredData,
        count: filteredData.length,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching raw shipping data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch raw shipping data',
      },
      { status: 500 }
    )
  }
}
