import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, isSourceDataValid } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * Convert risk score to risk bucket
 */
function getRiskBucket(riskScore: string | number | null | undefined): string {
  if (!riskScore) return 'Unknown'
  
  const score = typeof riskScore === 'string' 
    ? parseFloat(riskScore) || 0
    : riskScore
  
  if (score >= 0 && score < 0.3) return 'Low'
  if (score >= 0.3 && score < 0.6) return 'Medium'
  if (score >= 0.6 && score <= 1.0) return 'High'
  
  return 'Unknown'
}

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
 * GET /api/analytics/courier-outcome-by-risk
 * 
 * Get courier outcome distribution by risk bucket (High-risk orders only)
 * Returns 100% stacked bar chart data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const riskFilter = searchParams.get('riskFilter') || 'High' // Default to High-risk only

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

    let filteredData = filterShippingData(data, filters)

    // Filter by risk bucket if specified
    if (riskFilter !== 'All') {
      filteredData = filteredData.filter((record) => {
        const orderRisk = normalizeRisk(
          record.order_risk ||
          record['Order Risk'] ||
          record.order__risk
        )
        const riskBucket = getRiskBucket(orderRisk)
        return riskBucket === riskFilter
      })
    }

    // Aggregate by Courier × Outcome
    const courierMap = new Map<string, {
      courier: string
      total: number
      delivered: number
      rto: number
      undelivered: number
      canceled: number
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
          total: 0,
          delivered: 0,
          rto: 0,
          undelivered: 0,
          canceled: 0,
        })
      }

      const courierData = courierMap.get(courier)!
      courierData.total++

      const status = getDeliveryStatus(record)
      if (status === 'Delivered') courierData.delivered++
      else if (status === 'RTO') courierData.rto++
      else if (status === 'Undelivered') courierData.undelivered++
      else if (status === 'Canceled') courierData.canceled++
    })

    // Convert to array with percentages
    let result = Array.from(courierMap.values())
      .map((item) => ({
        courier: item.courier,
        total: item.total,
        delivered: item.delivered,
        deliveredPercent: item.total > 0 ? (item.delivered / item.total) * 100 : 0,
        rto: item.rto,
        rtoPercent: item.total > 0 ? (item.rto / item.total) * 100 : 0,
        undelivered: item.undelivered,
        undeliveredPercent: item.total > 0 ? (item.undelivered / item.total) * 100 : 0,
        canceled: item.canceled,
        canceledPercent: item.total > 0 ? (item.canceled / item.total) * 100 : 0,
      }))
      .filter((item) => item.total > 0 && item.courier !== 'Unknown') // Filter out Unknown
    
    // Sort by RTO % descending
    result.sort((a, b) => b.rtoPercent - a.rtoPercent)
    
    // Limit to top 5, merge rest into "Others"
    if (result.length > 5) {
      const top5 = result.slice(0, 5)
      const others = result.slice(5)
      const othersAggregated = {
        courier: 'Others',
        total: others.reduce((sum, item) => sum + item.total, 0),
        delivered: others.reduce((sum, item) => sum + item.delivered, 0),
        deliveredPercent: 0,
        rto: others.reduce((sum, item) => sum + item.rto, 0),
        rtoPercent: 0,
        undelivered: others.reduce((sum, item) => sum + item.undelivered, 0),
        undeliveredPercent: 0,
        canceled: others.reduce((sum, item) => sum + item.canceled, 0),
        canceledPercent: 0,
      }
      othersAggregated.deliveredPercent = othersAggregated.total > 0 
        ? (othersAggregated.delivered / othersAggregated.total) * 100 
        : 0
      othersAggregated.rtoPercent = othersAggregated.total > 0 
        ? (othersAggregated.rto / othersAggregated.total) * 100 
        : 0
      othersAggregated.undeliveredPercent = othersAggregated.total > 0 
        ? (othersAggregated.undelivered / othersAggregated.total) * 100 
        : 0
      othersAggregated.canceledPercent = othersAggregated.total > 0 
        ? (othersAggregated.canceled / othersAggregated.total) * 100 
        : 0
      result = [...top5, othersAggregated]
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching courier outcome by risk:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch courier outcome by risk',
      },
      { status: 500 }
    )
  }
}
