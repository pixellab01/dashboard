import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * POST /api/google-drive/read
 * Proxy Google Drive read request to Python backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    const response = await proxyToPythonBackend('/api/google-drive/read', {
      method: 'POST',
      body,
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Error reading Excel file from Google Drive:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to read file from Google Drive',
      },
      { status: 500 }
    )
  }
}
