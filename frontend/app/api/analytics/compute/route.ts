import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * POST /api/analytics/compute
 * Proxy analytics compute request to Python backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const asyncMode = searchParams.get('async_mode') === 'true'

    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const response = await proxyToPythonBackend('/api/analytics/compute', {
      method: 'POST',
      body,
      queryParams: asyncMode ? { async_mode: 'true' } : undefined,
    })

    // Stream the response directly to the client to avoid buffering large JSON in memory
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
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
