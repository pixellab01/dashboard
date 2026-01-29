import { NextRequest } from 'next/server'
import { proxyAnalyticsRequest } from '@/lib/analytics-proxy'

/**
 * GET /api/analytics/order-statuses
 * Proxy order statuses analytics request to Python backend
 */
export async function GET(request: NextRequest) {
  return proxyAnalyticsRequest(request, 'order-statuses')
}
