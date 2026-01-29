import { NextRequest } from 'next/server'
import { proxyAnalyticsRequest } from '@/lib/analytics-proxy'

/**
 * GET /api/analytics/courier-outcome-by-risk
 * Proxy courier outcome by risk analytics request to Python backend
 */
export async function GET(request: NextRequest) {
  return proxyAnalyticsRequest(request, 'courier-outcome-by-risk')
}
