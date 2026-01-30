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

    // Use 5 minute timeout for file reading (large files may take time)
    const response = await proxyToPythonBackend('/api/google-drive/read', {
      method: 'POST',
      body,
      timeout: 300000, // 5 minutes (300000ms)
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
