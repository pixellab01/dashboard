import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * GET /api/google-drive/files
 * Proxy Google Drive files request to Python backend
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    console.log('[Google Drive Files API] Proxying request to backend', { folderId })

    let response
    try {
      response = await proxyToPythonBackend('/api/google-drive/files', {
        method: 'GET',
        queryParams: folderId ? { folderId } : undefined,
      })
    } catch (proxyError: any) {
      console.error('[Google Drive Files API] Proxy error:', proxyError)
      
      // Check if it's a backend connection error
      const errorMsg = proxyError.message || ''
      if (errorMsg.includes('timeout') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot connect to backend server. Please ensure the Python backend is running at http://localhost:8000',
            isConfigurationError: false,
            isConnectionError: true,
          },
          { status: 503 } // Service Unavailable
        )
      }
      
      throw proxyError
    }

    let data
    try {
      data = await response.json()
    } catch (jsonError) {
      console.error('[Google Drive Files API] JSON parse error:', jsonError)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid response from backend server',
        },
        { status: 500 }
      )
    }
    
    console.log('[Google Drive Files API] Backend response:', { 
      success: data.success, 
      fileCount: data.files?.length || 0 
    })
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('[Google Drive Files API] Unexpected error:', error)
    console.error('[Google Drive Files API] Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Failed to list files from Google Drive'
    
    if (error.message?.includes('timeout')) {
      errorMessage = 'Backend connection timeout. Please ensure the backend server is running.'
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch')) {
      errorMessage = 'Cannot connect to backend server. Please ensure the backend is running at http://localhost:8000'
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        isConfigurationError: false,
      },
      { status: 500 }
    )
  }
}
