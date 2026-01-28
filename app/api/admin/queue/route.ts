import { NextRequest, NextResponse } from 'next/server'
import { getQueueStats, getJobStatus } from '@/lib/queue'

/**
 * GET /api/admin/queue
 * 
 * Get queue statistics and job status
 * Useful for monitoring the analytics computation queue
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    // If sessionId provided, get specific job status
    if (sessionId) {
      const jobStatus = await getJobStatus(sessionId)
      
      if (!jobStatus) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found for this session',
          },
          { status: 404 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          job: jobStatus,
        },
        { status: 200 }
      )
    }

    // Otherwise, get queue statistics
    const stats = await getQueueStats()

    return NextResponse.json(
      {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching queue stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch queue stats',
      },
      { status: 500 }
    )
  }
}
