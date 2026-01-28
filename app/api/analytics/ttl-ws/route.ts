import { NextRequest } from 'next/server'
import { getSessionTTLInfo } from '@/lib/redis'

/**
 * WebSocket-like endpoint using Server-Sent Events (SSE)
 * GET /api/analytics/ttl-ws?sessionId=xxx
 * 
 * Streams TTL information updates every second
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Session ID is required', { status: 400 })
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`))

      // Poll TTL info every second
      const interval = setInterval(async () => {
        try {
          const ttlInfo = await getSessionTTLInfo(sessionId)
          const message = JSON.stringify({
            type: 'ttl-update',
            data: ttlInfo,
            timestamp: new Date().toISOString(),
          })
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch (error) {
          console.error('Error fetching TTL info:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch TTL info' })}\n\n`))
        }
      }, 1000) // Update every second

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
