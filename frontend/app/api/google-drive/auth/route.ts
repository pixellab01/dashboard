import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/google-drive/auth
 * Proxy Google Drive auth request to Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const response = await proxyToPythonBackend('/api/google-drive/auth', {
      method: 'GET',
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error generating auth URL:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate authorization URL',
      },
      { status: 500 }
    )
  }
}
