const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set the workspace root to fix lockfile detection warning
  outputFileTracingRoot: path.join(__dirname),
  
  // Allow cross-origin requests in development for _next static resources
  // IMPORTANT: You must completely stop and restart the dev server for changes to take effect
  allowedDevOrigins: [
    'http://192.168.1.157:3004',
  ],
  
  // Add CORS headers for _next static chunks
  async headers() {
    return [
      {
        // Match all _next static files
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, HEAD, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
