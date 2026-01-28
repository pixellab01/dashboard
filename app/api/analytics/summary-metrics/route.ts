import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * GET /api/analytics/summary-metrics
 * 
 * Get summary metrics from filtered shipping data
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

    // Calculate metrics from filtered dataset
    let syncedOrders = 0
    let gmv = 0
    let inTransitOrders = 0
    let deliveredOrders = 0
    let rtoOrders = 0
    let undeliveredOrders = 0

    filteredData.forEach((record: any) => {
      syncedOrders++

      // Count orders by status - use original Status field first, then fall back to delivery_status
      // This ensures we count based on the actual Status from CSV, not computed delivery_status
      const status = String(
        record.original_status ||  // Preserved original Status field
        record['Status'] ||        // Original field name (before normalization)
        record.status ||           // Normalized field name (after normalizeKeys)
        record.delivery_status ||  // Preprocessed field (fallback)
        ''
      ).toUpperCase().trim()
      
      // GMV - Only count for DELIVERED orders
      if (status === 'DELIVERED') {
        deliveredOrders++
        // GMV - Check for gmv_amount, order_value, or total_order_value
        const gmvAmount = record.gmv_amount || 
                         record.order_value || 
                         record['Order Total'] ||
                         record.order__total ||
                         record.total_order_value ||
                         0
        gmv += parseFloat(String(gmvAmount)) || 0
      } else if (status === 'OFD' || status === 'OUT FOR DELIVERY' || status === 'IN TRANSIT' || status === 'IN_TRANSIT' || status === 'IN TRANSIT-AT DESTINATION HUB') {
        inTransitOrders++
      } else if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
        rtoOrders++
      } else if (status === 'NDR' || status === 'PENDING' || status === 'UNDELIVERED' || status.includes('UNDELIVERED')) {
        undeliveredOrders++
      }
    })

    // Calculate percentages according to new formulas
    const inTransitPercent = syncedOrders > 0 ? (inTransitOrders / syncedOrders) * 100 : 0
    
    const totalFinalOrders = deliveredOrders + rtoOrders + undeliveredOrders
    const deliveryPercent = totalFinalOrders > 0 ? (deliveredOrders / totalFinalOrders) * 100 : 0
    const rtoPercent = totalFinalOrders > 0 ? (rtoOrders / totalFinalOrders) * 100 : 0

    return NextResponse.json(
      {
        success: true,
        metrics: {
          syncedOrders,
          gmv,
          inTransitPercent,
          deliveryPercent,
          rtoPercent,
          inTransitOrders,
          deliveredOrders,
          rtoOrders,
          undeliveredOrders,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching summary metrics:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch summary metrics',
      },
      { status: 500 }
    )
  }
}
