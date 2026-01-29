import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * GET /api/analytics/order-statuses
 * 
 * Get all unique order statuses with counts and percentages
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

    // Count all unique statuses
    const statusMap = new Map<string, number>()

    filteredData.forEach((record: any) => {
      // Use original Status field first for accuracy
      const status = String(
        record.original_status ||  // Preserved original Status field
        record['Status'] ||        // Original field name (before normalization)
        record.status ||           // Normalized field name (after normalizeKeys)
        record.delivery_status ||  // Preprocessed field (fallback)
        'UNKNOWN'
      ).toUpperCase().trim()

      if (status && status !== 'UNKNOWN' && status !== 'N/A' && status !== 'NULL' && status !== '') {
        const currentCount = statusMap.get(status) || 0
        statusMap.set(status, currentCount + 1)
      }
    })

    // Convert to array and calculate percentages
    const totalOrders = filteredData.length
    const statusData = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percent: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
      }))
      // Sort by count in ascending order
      .sort((a, b) => a.count - b.count)

    return NextResponse.json(
      {
        success: true,
        data: statusData,
        count: statusData.length,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching order statuses:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch order statuses',
      },
      { status: 500 }
    )
  }
}
