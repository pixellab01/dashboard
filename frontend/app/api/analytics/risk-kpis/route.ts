import { NextRequest } from 'next/server'
import { proxyAnalyticsRequest } from '@/lib/analytics-proxy'

/**
 * GET /api/analytics/risk-kpis
 * Proxy risk KPIs analytics request to Python backend
 */
export async function GET(request: NextRequest) {
  return proxyAnalyticsRequest(request, 'risk-kpis')
}
