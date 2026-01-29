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
 * GET /api/analytics/risk-kpis
 * 
 * Get risk KPIs:
 * - % High-Risk Orders
 * - High-Risk RTO Rate
 * - Courier-wise Risk Delta
 * - Pincode Risk Concentration (% from top 10)
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
          data: {},
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
          data: {},
        },
        { status: 200 }
      )
    }

    const filteredData = filterShippingData(data, filters)
    const totalOrders = filteredData.length

    // Calculate risk buckets
    let highRiskOrders = 0
    let highRiskRtoCount = 0
    let highRiskTotal = 0

    // Courier risk deltas
    const courierRiskMap = new Map<string, {
      total: number
      highRiskCount: number
      rtoCount: number
      highRiskRtoCount: number
    }>()

    // Pincode risk concentration
    const pincodeVolumeMap = new Map<string, number>()

    filteredData.forEach((record) => {
      const orderRisk = normalizeRisk(
        record.order_risk ||
        record['Order Risk'] ||
        record.order__risk
      )
      const riskBucket = getRiskBucket(orderRisk)

      if (riskBucket === 'High') {
        highRiskOrders++
        highRiskTotal++
        const status = getDeliveryStatus(record)
        if (status === 'RTO') {
          highRiskRtoCount++
        }
      }

      // Courier analysis
      const courier = String(
        record.master_courier ||
        record['Master Courier'] ||
        record.master__courier ||
        'Unknown'
      ).trim()

      if (!courierRiskMap.has(courier)) {
        courierRiskMap.set(courier, {
          total: 0,
          highRiskCount: 0,
          rtoCount: 0,
          highRiskRtoCount: 0,
        })
      }

      const courierData = courierRiskMap.get(courier)!
      courierData.total++
      if (riskBucket === 'High') courierData.highRiskCount++
      
      const status = getDeliveryStatus(record)
      if (status === 'RTO') {
        courierData.rtoCount++
        if (riskBucket === 'High') courierData.highRiskRtoCount++
      }

      // Pincode volume
      const pincode = String(
        record.pickup_pincode ||
        record['Pickup Pincode'] ||
        record.pickup__pincode ||
        'Unknown'
      ).trim()
      pincodeVolumeMap.set(pincode, (pincodeVolumeMap.get(pincode) || 0) + 1)
    })

    // Calculate KPIs
    const highRiskPercent = totalOrders > 0 ? (highRiskOrders / totalOrders) * 100 : 0
    const highRiskRtoRate = highRiskTotal > 0 ? (highRiskRtoCount / highRiskTotal) * 100 : 0

    // Courier-wise risk delta (difference between high-risk RTO rate and overall RTO rate)
    const courierRiskDeltas: Array<{ courier: string; delta: number }> = []
    courierRiskMap.forEach((data, courier) => {
      const overallRtoRate = data.total > 0 ? (data.rtoCount / data.total) * 100 : 0
      const highRiskRtoRate = data.highRiskCount > 0 
        ? (data.highRiskRtoCount / data.highRiskCount) * 100 
        : 0
      const delta = highRiskRtoRate - overallRtoRate
      courierRiskDeltas.push({ courier, delta })
    })
    courierRiskDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    // Pincode risk concentration (top 10 pincodes)
    const top10Pincodes = Array.from(pincodeVolumeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    const top10Volume = top10Pincodes.reduce((sum, [, count]) => sum + count, 0)
    const pincodeRiskConcentration = totalOrders > 0 
      ? (top10Volume / totalOrders) * 100 
      : 0

    return NextResponse.json(
      {
        success: true,
        data: {
          highRiskPercent,
          highRiskRtoRate,
          courierRiskDeltas: courierRiskDeltas.slice(0, 5), // Top 5 couriers by delta
          pincodeRiskConcentration,
          totalOrders,
          highRiskOrders,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching risk KPIs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch risk KPIs',
      },
      { status: 500 }
    )
  }
}
