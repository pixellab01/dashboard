#!/usr/bin/env node

/**
 * Worker Process Script
 * 
 * Run this script to start the analytics worker process
 * This should run as a separate process from your Next.js server
 * 
 * Usage:
 *   npm run worker        # Start worker
 *   npm run worker:dev    # Start worker with watch mode (development)
 */

// Import worker to start it
import '../lib/workers/analyticsWorker'

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  process.exit(0)
})
