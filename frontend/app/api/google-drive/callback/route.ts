import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/google-drive/callback
 * Proxy Google Drive OAuth callback to Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const format = searchParams.get('format')

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization code not provided',
        },
        { status: 400 }
      )
    }

    // Proxy to Python backend with query parameters
    const response = await proxyToPythonBackend('/api/google-drive/callback', {
      method: 'GET',
      queryParams: {
        code,
        ...(format && { format }),
      },
    })

    const data = await response.json()
    
    // If Python backend returns HTML, return it as HTML
    if (format !== 'json' && !response.headers.get('content-type')?.includes('application/json')) {
      const htmlContent = await response.text()
      return new NextResponse(htmlContent, {
        status: response.status,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error exchanging code for token:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to exchange authorization code',
      },
      { status: 500 }
    )
  }
}
