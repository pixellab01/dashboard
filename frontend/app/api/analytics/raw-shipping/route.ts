import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, getAnalyticsFromRedis, saveAnalyticsToRedis } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * GET /api/analytics/raw-shipping
 * 
 * Get raw filtered shipping data (paginated to prevent 64MB responses)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500) // Max 500 per page

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
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

    // Build cache key for filtered data
    const filterKey = JSON.stringify(filters)
    const cacheKey = `raw-shipping:${filterKey}`
    
    // Try to get cached filtered data
    let filteredData = await getAnalyticsFromRedis(sessionId, cacheKey)
    
    if (!filteredData) {
      // Cache miss - fetch raw data, filter, and cache
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

      // Apply filters
      filteredData = filterShippingData(data, filters)
      
      // Cache the filtered result (limit to 10k rows max for caching)
      if (filteredData.length <= 10000) {
        await saveAnalyticsToRedis(sessionId, cacheKey, filteredData)
      }
    }

    // Paginate the results
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = filteredData.slice(startIndex, endIndex)

    return NextResponse.json(
      {
        success: true,
        data: paginatedData,
        count: paginatedData.length,
        total: filteredData.length,
        page,
        limit,
        totalPages: Math.ceil(filteredData.length / limit),
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
