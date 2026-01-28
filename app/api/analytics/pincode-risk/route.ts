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
 * GET /api/analytics/pincode-risk
 * 
 * Get pincode risk heatmap data (Top 30 pincodes by volume)
 * Returns Order Risk and RTO Risk per pincode
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

    // Aggregate by pickup pincode
    const pincodeMap = new Map<string, {
      pincode: string
      orderCount: number
      orderRiskSum: number
      rtoRiskSum: number
      orderRiskCount: number
      rtoRiskCount: number
    }>()

    filteredData.forEach((record) => {
      const pincode = String(
        record.pickup_pincode ||
        record['Pickup Pincode'] ||
        record.pickup__pincode ||
        'Unknown'
      ).trim()

      if (!pincodeMap.has(pincode)) {
        pincodeMap.set(pincode, {
          pincode,
          orderCount: 0,
          orderRiskSum: 0,
          rtoRiskSum: 0,
          orderRiskCount: 0,
          rtoRiskCount: 0,
        })
      }

      const pincodeData = pincodeMap.get(pincode)!
      pincodeData.orderCount++

      // Order Risk
      const orderRisk = normalizeRisk(
        record.order_risk ||
        record['Order Risk'] ||
        record.order__risk
      )
      if (orderRisk > 0) {
        pincodeData.orderRiskSum += orderRisk
        pincodeData.orderRiskCount++
      }

      // RTO Risk
      const rtoRisk = normalizeRisk(
        record.rto_risk ||
        record['RTO Risk'] ||
        record.rto__risk ||
        record.rtoRisk
      )
      if (rtoRisk > 0) {
        pincodeData.rtoRiskSum += rtoRisk
        pincodeData.rtoRiskCount++
      }
    })

    // Convert to array and calculate averages
    const result = Array.from(pincodeMap.values())
      .map((item) => ({
        pincode: item.pincode,
        orderCount: item.orderCount,
        avgOrderRisk: item.orderRiskCount > 0 
          ? item.orderRiskSum / item.orderRiskCount 
          : 0,
        avgRtoRisk: item.rtoRiskCount > 0 
          ? item.rtoRiskSum / item.rtoRiskCount 
          : 0,
        orderRiskBucket: getRiskBucket(
          item.orderRiskCount > 0 
            ? item.orderRiskSum / item.orderRiskCount 
            : 0
        ),
        rtoRiskBucket: getRiskBucket(
          item.rtoRiskCount > 0 
            ? item.rtoRiskSum / item.rtoRiskCount 
            : 0
        ),
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 30) // Top 30 by volume

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching pincode risk:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pincode risk',
      },
      { status: 500 }
    )
  }
}
