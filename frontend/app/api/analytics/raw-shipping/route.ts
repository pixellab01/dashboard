import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/analytics/raw-shipping
 * Proxy raw shipping data request to Python backend
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

    // Extract all query parameters
    const queryParams: Record<string, string | string[]> = { sessionId }
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const orderStatus = searchParams.get('orderStatus')
    const paymentMethod = searchParams.get('paymentMethod')
    const channel = searchParams.get('channel')
    const sku = searchParams.getAll('sku')
    const productName = searchParams.getAll('productName')
    const limit = searchParams.get('limit')
    const page = searchParams.get('page')

    if (startDate) queryParams.startDate = startDate
    if (endDate) queryParams.endDate = endDate
    if (orderStatus) queryParams.orderStatus = orderStatus
    if (paymentMethod) queryParams.paymentMethod = paymentMethod
    if (channel) queryParams.channel = channel
    if (sku.length > 0) queryParams.sku = sku
    if (productName.length > 0) queryParams.productName = productName
    if (limit) queryParams.limit = limit
    if (page) queryParams.page = page

    const response = await proxyToPythonBackend('/api/analytics/raw-shipping', {
      method: 'GET',
      queryParams,
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
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
