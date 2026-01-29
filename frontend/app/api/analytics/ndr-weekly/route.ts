import { NextRequest } from 'next/server'
import { proxyAnalyticsRequest } from '@/lib/analytics-proxy'

/**
 * GET /api/analytics/ndr-weekly
 * Proxy NDR weekly analytics request to Python backend
 */
export async function GET(request: NextRequest) {
  return proxyAnalyticsRequest(request, 'ndr-weekly')
}
