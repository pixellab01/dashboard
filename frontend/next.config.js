/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow cross-origin requests in development for _next static resources
  // IMPORTANT: You must completely stop and restart the dev server for changes to take effect
  allowedDevOrigins: [
    '*',
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
