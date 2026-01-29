import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, isSourceDataValid } from '@/lib/redis'
import { filterShippingData, FilterParams } from '@/lib/analytics'

/**
 * Status grouping function - maps raw statuses to business categories
 */
function getStatusCategory(status: string): string {
  const upperStatus = status.toUpperCase().trim()
  
  // Delivered
  if (upperStatus === 'DELIVERED') return 'Delivered'
  
  // In Transit
  if (
    upperStatus.includes('IN TRANSIT') ||
    upperStatus.includes('OUT FOR DELIVERY') ||
    upperStatus.includes('OUT FOR PICKUP') ||
    upperStatus.includes('PICKED UP') ||
    upperStatus.includes('REACHED DESTINATION HUB') ||
    upperStatus.includes('AT DESTINATION HUB')
  ) return 'In Transit'
  
  // RTO Flow
  if (
    upperStatus.includes('RTO') ||
    upperStatus === 'RTO INITIATED' ||
    upperStatus === 'RTO IN TRANSIT' ||
    upperStatus === 'RTO NDR' ||
    upperStatus === 'RTO DELIVERED'
  ) return 'RTO Flow'
  
  // Undelivered Attempts
  if (
    upperStatus.includes('UNDELIVERED') ||
    upperStatus.includes('NDR')
  ) return 'Undelivered Attempts'
  
  // Canceled / Lost
  if (
    upperStatus === 'CANCELED' ||
    upperStatus === 'CANCELLED' ||
    upperStatus === 'LOST' ||
    upperStatus === 'DESTROYED' ||
    upperStatus === 'UNTRACEABLE'
  ) return 'Canceled / Lost'
  
  // Exceptions
  if (
    upperStatus.includes('EXCEPTION') ||
    upperStatus.includes('REACHED BACK') ||
    upperStatus.includes('SELLER')
  ) return 'Exceptions'
  
  return 'Other'
}

/**
 * GET /api/analytics/payment-method-outcome
 * 
 * Get cross-tabulated data: Payment Method vs Status Category
 * Returns real-time data from raw shipping records
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

    // Check if source data is still valid
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

    // Get raw shipping data
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

    // Apply filters
    const filteredData = filterShippingData(data, filters)

    // Cross-tabulate: Payment Method x Status Category
    const crossTabMap = new Map<string, Map<string, number>>()
    const paymentMethodTotals = new Map<string, number>()

    filteredData.forEach((record) => {
      // Get payment method
      const paymentMethod = String(
        record.payment_method ||
        record['Payment Method'] ||
        record.payment__method ||
        'Unknown'
      ).trim()

      // Get status and categorize it
      const rawStatus = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        'UNKNOWN'
      ).trim()
      
      const statusCategory = getStatusCategory(rawStatus)

      // Initialize payment method map if needed
      if (!crossTabMap.has(paymentMethod)) {
        crossTabMap.set(paymentMethod, new Map<string, number>())
        paymentMethodTotals.set(paymentMethod, 0)
      }

      // Initialize status category count if needed
      const statusMap = crossTabMap.get(paymentMethod)!
      const currentCount = statusMap.get(statusCategory) || 0
      statusMap.set(statusCategory, currentCount + 1)

      // Update payment method total
      const currentTotal = paymentMethodTotals.get(paymentMethod) || 0
      paymentMethodTotals.set(paymentMethod, currentTotal + 1)
    })

    // Get all unique status categories (from all payment methods)
    const allStatusCategories = new Set<string>()
    crossTabMap.forEach((statusMap) => {
      statusMap.forEach((_, category) => {
        allStatusCategories.add(category)
      })
    })

    // Build result array
    const result: any[] = []
    crossTabMap.forEach((statusMap, paymentMethod) => {
      const total = paymentMethodTotals.get(paymentMethod) || 0
      
      const dataPoint: any = {
        paymentMethod,
        total,
      }

      // Add percentage for each status category
      allStatusCategories.forEach((category) => {
        const count = statusMap.get(category) || 0
        const percent = total > 0 ? (count / total) * 100 : 0
        dataPoint[category] = percent
      })

      result.push(dataPoint)
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
        statusCategories: Array.from(allStatusCategories),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching payment method outcome:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch payment method outcome',
      },
      { status: 500 }
    )
  }
}
