/**
 * Standalone WebSocket Server for TTL Updates
 * Run with: npm run websocket:dev or npm run websocket
 */

import { initWebSocketServer } from '../lib/websocket-server'

const PORT = process.env.WEBSOCKET_PORT ? parseInt(process.env.WEBSOCKET_PORT) : 8080

console.log('Starting WebSocket server...')
initWebSocketServer(PORT)

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing WebSocket server...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, closing WebSocket server...')
  process.exit(0)
})
