import { NextRequest } from 'next/server'
import { proxyAnalyticsRequest } from '@/lib/analytics-proxy'

/**
 * GET /api/analytics/payment-method
 * Proxy payment method analytics request to Python backend
 */
export async function GET(request: NextRequest) {
  return proxyAnalyticsRequest(request, 'payment-method')
}
