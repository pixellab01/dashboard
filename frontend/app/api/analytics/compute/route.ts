import { NextRequest, NextResponse } from 'next/server'
import { computeAllAnalytics } from '@/lib/analytics'

/**
 * POST /api/analytics/compute
 * 
 * Compute analytics from Redis data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Extract filter parameters if provided
    const filters = body.filters || undefined

    // Compute all analytics
    const result = await computeAllAnalytics(sessionId, filters)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to compute analytics',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Analytics computed successfully',
        sessionId,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error computing analytics:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to compute analytics',
      },
      { status: 500 }
    )
  }
}
