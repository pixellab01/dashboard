/**
 * WebSocket Server for TTL Information Updates
 * This server runs alongside Next.js and provides real-time TTL updates
 */

import { WebSocketServer, WebSocket } from 'ws'
import { getSessionTTLInfo } from './redis'

interface ClientConnection {
  ws: WebSocket
  sessionId: string
}

let wss: WebSocketServer | null = null
const clients: Map<string, Set<ClientConnection>> = new Map()

/**
 * Initialize WebSocket Server
 */
export function initWebSocketServer(port: number = 8080) {
  if (wss) {
    console.log('WebSocket server already initialized')
    return wss
  }

  wss = new WebSocketServer({ port })

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const sessionId = url.searchParams.get('sessionId')

    if (!sessionId) {
      ws.close(1008, 'Session ID is required')
      return
    }

    console.log(`WebSocket client connected for session: ${sessionId}`)

    const connection: ClientConnection = { ws, sessionId }

    // Add client to session group
    if (!clients.has(sessionId)) {
      clients.set(sessionId, new Set())
    }
    clients.get(sessionId)!.add(connection)

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId,
      timestamp: new Date().toISOString(),
    }))

    // Start sending TTL updates every second
    const interval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const ttlInfo = await getSessionTTLInfo(sessionId)
          ws.send(JSON.stringify({
            type: 'ttl-update',
            data: ttlInfo,
            timestamp: new Date().toISOString(),
          }))
        } catch (error) {
          console.error('Error fetching TTL info for WebSocket:', error)
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to fetch TTL info',
            timestamp: new Date().toISOString(),
          }))
        }
      } else {
        clearInterval(interval)
      }
    }, 1000)

    // Handle client disconnect
    ws.on('close', () => {
      console.log(`WebSocket client disconnected for session: ${sessionId}`)
      clearInterval(interval)
      const sessionClients = clients.get(sessionId)
      if (sessionClients) {
        sessionClients.delete(connection)
        if (sessionClients.size === 0) {
          clients.delete(sessionId)
        }
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      clearInterval(interval)
    })
  })

  wss.on('listening', () => {
    console.log(`WebSocket server listening on port ${port}`)
  })

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error)
  })

  return wss
}

/**
 * Get WebSocket Server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss
}

/**
 * Close WebSocket Server
 */
export function closeWebSocketServer() {
  if (wss) {
    wss.close()
    wss = null
    clients.clear()
    console.log('WebSocket server closed')
  }
}

/**
 * Broadcast TTL update to all clients for a session
 */
export async function broadcastTTLUpdate(sessionId: string) {
  const sessionClients = clients.get(sessionId)
  if (!sessionClients || sessionClients.size === 0) {
    return
  }

  try {
    const ttlInfo = await getSessionTTLInfo(sessionId)
    const message = JSON.stringify({
      type: 'ttl-update',
      data: ttlInfo,
      timestamp: new Date().toISOString(),
    })

    sessionClients.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(message)
      }
    })
  } catch (error) {
    console.error('Error broadcasting TTL update:', error)
  }
}
