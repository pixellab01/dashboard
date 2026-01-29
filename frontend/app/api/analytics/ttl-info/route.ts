import { NextRequest, NextResponse } from 'next/server'
import { getSessionTTLInfo } from '@/lib/redis'

/**
 * GET /api/analytics/ttl-info
 * 
 * Get TTL information for shipping data and analytics cache
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

    const ttlInfo = await getSessionTTLInfo(sessionId)

    return NextResponse.json(ttlInfo, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching TTL info:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch TTL info',
      },
      { status: 500 }
    )
  }
}
