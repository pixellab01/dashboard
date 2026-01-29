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
 * Calculate courier failure rate for a courier
 */
function calculateCourierFailureRate(
  courier: string,
  allRecords: any[]
): number {
  const courierRecords = allRecords.filter((record) => {
    const recordCourier = String(
      record.master_courier ||
      record['Master Courier'] ||
      record.master__courier ||
      'Unknown'
    ).trim()
    return recordCourier === courier
  })

  if (courierRecords.length === 0) return 0

  const failures = courierRecords.filter((record) => {
    const status = getDeliveryStatus(record)
    return status === 'RTO' || status === 'Undelivered' || status === 'Canceled'
  })

  return failures.length / courierRecords.length
}

/**
 * Calculate composite risk score
 * Composite Risk Score = 0.4 * Order Risk + 0.4 * RTO Risk + 0.2 * Courier Failure Rate
 */
function calculateCompositeRisk(
  record: any,
  courierFailureRate: number
): number {
  const orderRisk = normalizeRisk(
    record.order_risk ||
    record['Order Risk'] ||
    record.order__risk
  )

  const rtoRisk = normalizeRisk(
    record.rto_risk ||
    record['RTO Risk'] ||
    record.rto__risk ||
    record.rtoRisk
  )

  return 0.4 * orderRisk + 0.4 * rtoRisk + 0.2 * courierFailureRate
}

/**
 * Get risk segment from composite score
 */
function getRiskSegment(compositeScore: number): {
  segment: string
  action: string
  color: string
  threshold: string
} {
  if (compositeScore >= 0.75) {
    return {
      segment: 'Very High',
      action: 'Block COD / Force prepaid',
      color: '#dc2626', // red-600
      threshold: '≥ 0.75',
    }
  } else if (compositeScore >= 0.6) {
    return {
      segment: 'High',
      action: 'Prefer best courier',
      color: '#f97316', // orange-500
      threshold: '0.60 - 0.74',
    }
  } else if (compositeScore >= 0.4) {
    return {
      segment: 'Medium',
      action: 'Monitor',
      color: '#eab308', // yellow-500
      threshold: '0.40 - 0.59',
    }
  } else {
    return {
      segment: 'Low',
      action: 'Auto-approve',
      color: '#10b981', // green-500
      threshold: '< 0.40',
    }
  }
}

/**
 * GET /api/analytics/risk-segmentation
 * 
 * Get risk segmentation pyramid data
 * Calculates composite risk scores and segments orders
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

    // Pre-calculate courier failure rates
    const courierFailureRates = new Map<string, number>()
    const allCouriers = new Set<string>()
    
    filteredData.forEach((record) => {
      const courier = String(
        record.master_courier ||
        record['Master Courier'] ||
        record.master__courier ||
        'Unknown'
      ).trim()
      allCouriers.add(courier)
    })

    allCouriers.forEach((courier) => {
      const failureRate = calculateCourierFailureRate(courier, filteredData)
      courierFailureRates.set(courier, failureRate)
    })

    // Calculate composite risk for each order and segment
    const segmentMap = new Map<string, {
      segment: string
      action: string
      color: string
      threshold: string
      count: number
      totalValue: number
      avgCompositeRisk: number
      rtoCount: number
      deliveredCount: number
    }>()

    filteredData.forEach((record) => {
      const courier = String(
        record.master_courier ||
        record['Master Courier'] ||
        record.master__courier ||
        'Unknown'
      ).trim()

      const courierFailureRate = courierFailureRates.get(courier) || 0
      const compositeRisk = calculateCompositeRisk(record, courierFailureRate)
      const segmentInfo = getRiskSegment(compositeRisk)

      if (!segmentMap.has(segmentInfo.segment)) {
        segmentMap.set(segmentInfo.segment, {
          ...segmentInfo,
          count: 0,
          totalValue: 0,
          avgCompositeRisk: 0,
          rtoCount: 0,
          deliveredCount: 0,
        })
      }

      const segmentData = segmentMap.get(segmentInfo.segment)!
      segmentData.count++
      segmentData.avgCompositeRisk += compositeRisk

      const orderValue = parseFloat(record.order_value || record['Order Total'] || record.order__value || '0') || 0
      segmentData.totalValue += orderValue

      const status = getDeliveryStatus(record)
      if (status === 'RTO') segmentData.rtoCount++
      if (status === 'Delivered') segmentData.deliveredCount++
    })

    // Calculate averages and percentages
    const totalOrders = filteredData.length
    const result = Array.from(segmentMap.values())
      .map((segment) => {
        const avgOrderValue = segment.count > 0 ? segment.totalValue / segment.count : 0
        const rtoRate = segment.count > 0 ? (segment.rtoCount / segment.count) * 100 : 0
        // Estimated Loss = Orders × RTO Rate × Avg Order Value
        const estimatedLoss = (segment.count * (rtoRate / 100) * avgOrderValue)
        // Business Impact = Orders × RTO Rate × Avg Order Value
        const businessImpact = estimatedLoss
        
        return {
          ...segment,
          avgCompositeRisk: segment.count > 0 ? segment.avgCompositeRisk / segment.count : 0,
          percent: totalOrders > 0 ? (segment.count / totalOrders) * 100 : 0,
          rtoRate,
          deliveryRate: segment.count > 0 ? (segment.deliveredCount / segment.count) * 100 : 0,
          avgOrderValue,
          estimatedLoss,
          businessImpact,
        }
      })
      .sort((a, b) => {
        // Sort by business impact (highest first)
        return b.businessImpact - a.businessImpact
      })

    return NextResponse.json(
      {
        success: true,
        data: result,
        totalOrders,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching risk segmentation:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch risk segmentation',
      },
      { status: 500 }
    )
  }
}
