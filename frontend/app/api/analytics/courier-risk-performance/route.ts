import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, isSourceDataValid } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * Normalize risk value from string to number
 */
function normalizeRisk(risk: any): number {
  if (risk === null || risk === undefined) return 0
  
  if (typeof risk === 'string') {
    const lower = risk.toLowerCase().trim()
    if (lower === 'low') return 0.2
    if (lower === 'medium') return 0.5
    if (lower === 'high') return 0.8
    if (lower === 'very-high' || lower === 'very_high') return 0.95
    const parsed = parseFloat(risk)
    if (!isNaN(parsed)) return parsed
  }
  
  if (typeof risk === 'number') return risk
  
  return 0
}

/**
 * Get delivery status category
 */
function getDeliveryStatus(record: any): string {
  const status = String(
    record.original_status ||
    record['Status'] ||
    record.status ||
    record.delivery_status ||
    'UNKNOWN'
  ).toUpperCase().trim()

  if (status === 'DELIVERED') return 'Delivered'
  if (status.includes('RTO') || status === 'RTO DELIVERED') return 'RTO'
  if (status.includes('UNDELIVERED') || status.includes('NDR')) return 'Undelivered'
  if (status === 'CANCELED' || status === 'CANCELLED' || status === 'LOST' || status === 'DESTROYED') return 'Canceled'
  
  return 'In Transit'
}

/**
 * GET /api/analytics/courier-risk-performance
 * 
 * Get courier performance matrix data
 * X-axis: Avg Order Risk
 * Y-axis: Avg RTO Risk
 * Bubble size: Order volume
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

    const sourceValid = await isSourceDataValid(sessionId)
    if (!sourceValid) {
      return NextResponse.json(
        {
          success: true,
          data: [],
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

    const data = await getShippingDataFromRedis(sessionId)
    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        { status: 200 }
      )
    }

    const filteredData = filterShippingData(data, filters)

    // Aggregate by Master Courier
    const courierMap = new Map<string, {
      courier: string
      orderCount: number
      orderRiskSum: number
      rtoRiskSum: number
      orderRiskCount: number
      rtoRiskCount: number
      deliveredCount: number
      rtoCount: number
      undeliveredCount: number
    }>()

    filteredData.forEach((record) => {
      const courier = String(
        record.master_courier ||
        record['Master Courier'] ||
        record.master__courier ||
        'Unknown'
      ).trim()

      if (!courierMap.has(courier)) {
        courierMap.set(courier, {
          courier,
          orderCount: 0,
          orderRiskSum: 0,
          rtoRiskSum: 0,
          orderRiskCount: 0,
          rtoRiskCount: 0,
          deliveredCount: 0,
          rtoCount: 0,
          undeliveredCount: 0,
        })
      }

      const courierData = courierMap.get(courier)!
      courierData.orderCount++

      // Order Risk
      const orderRisk = normalizeRisk(
        record.order_risk ||
        record['Order Risk'] ||
        record.order__risk
      )
      if (orderRisk > 0) {
        courierData.orderRiskSum += orderRisk
        courierData.orderRiskCount++
      }

      // RTO Risk
      const rtoRisk = normalizeRisk(
        record.rto_risk ||
        record['RTO Risk'] ||
        record.rto__risk ||
        record.rtoRisk
      )
      if (rtoRisk > 0) {
        courierData.rtoRiskSum += rtoRisk
        courierData.rtoRiskCount++
      }

      // Delivery status
      const status = getDeliveryStatus(record)
      if (status === 'Delivered') courierData.deliveredCount++
      else if (status === 'RTO') courierData.rtoCount++
      else if (status === 'Undelivered') courierData.undeliveredCount++
    })

    // Convert to array and calculate averages
    const result = Array.from(courierMap.values())
      .map((item) => ({
        courier: item.courier,
        orderVolume: item.orderCount,
        avgOrderRisk: item.orderRiskCount > 0 
          ? item.orderRiskSum / item.orderRiskCount 
          : 0,
        avgRtoRisk: item.rtoRiskCount > 0 
          ? item.rtoRiskSum / item.rtoRiskCount 
          : 0,
        deliveredRate: item.orderCount > 0 
          ? (item.deliveredCount / item.orderCount) * 100 
          : 0,
        rtoRate: item.orderCount > 0 
          ? (item.rtoCount / item.orderCount) * 100 
          : 0,
        courierFailureRate: item.orderCount > 0 
          ? ((item.rtoCount + item.undeliveredCount) / item.orderCount) * 100 
          : 0,
      }))
      .filter((item) => item.orderVolume > 0) // Only couriers with orders
      .sort((a, b) => b.orderVolume - a.orderVolume)

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching courier risk performance:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch courier risk performance',
      },
      { status: 500 }
    )
  }
}
