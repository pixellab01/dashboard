import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, isSourceDataValid } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

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
 * GET /api/analytics/pincode-courier-failure
 * 
 * Get pincode × courier failure map (heatmap)
 * Rows: Top 20 pincodes
 * Columns: Master Courier
 * Metric: RTO Rate %
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

    // First, get top 20 pincodes by volume
    const pincodeVolumeMap = new Map<string, number>()
    filteredData.forEach((record) => {
      const pincode = String(
        record.pickup_pincode ||
        record['Pickup Pincode'] ||
        record.pickup__pincode ||
        'Unknown'
      ).trim()
      pincodeVolumeMap.set(pincode, (pincodeVolumeMap.get(pincode) || 0) + 1)
    })

    const topPincodes = Array.from(pincodeVolumeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([pincode]) => pincode)

    // Aggregate by Pincode × Courier
    const crossTabMap = new Map<string, Map<string, {
      total: number
      rto: number
    }>>()

    filteredData.forEach((record) => {
      const pincode = String(
        record.pickup_pincode ||
        record['Pickup Pincode'] ||
        record.pickup__pincode ||
        'Unknown'
      ).trim()

      if (!topPincodes.includes(pincode)) return

      const courier = String(
        record.master_courier ||
        record['Master Courier'] ||
        record.master__courier ||
        'Unknown'
      ).trim()

      if (!crossTabMap.has(pincode)) {
        crossTabMap.set(pincode, new Map())
      }

      const courierMap = crossTabMap.get(pincode)!
      if (!courierMap.has(courier)) {
        courierMap.set(courier, { total: 0, rto: 0 })
      }

      const courierData = courierMap.get(courier)!
      courierData.total++

      const status = getDeliveryStatus(record)
      if (status === 'RTO') {
        courierData.rto++
      }
    })

    // Get all unique couriers
    const allCouriers = new Set<string>()
    crossTabMap.forEach((courierMap) => {
      courierMap.forEach((_, courier) => {
        allCouriers.add(courier)
      })
    })

    // Build result array
    const result: any[] = []
    topPincodes.forEach((pincode) => {
      const courierMap = crossTabMap.get(pincode) || new Map()
      const dataPoint: any = {
        pincode,
      }

      allCouriers.forEach((courier) => {
        const courierData = courierMap.get(courier) || { total: 0, rto: 0 }
        const rtoRate = courierData.total > 0 
          ? (courierData.rto / courierData.total) * 100 
          : 0
        dataPoint[courier] = rtoRate
        dataPoint[`${courier}_count`] = courierData.total
      })

      result.push(dataPoint)
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
        couriers: Array.from(allCouriers),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching pincode courier failure:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pincode courier failure',
      },
      { status: 500 }
    )
  }
}
