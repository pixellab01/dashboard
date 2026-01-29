import { NextRequest, NextResponse } from 'next/server'
import { listExcelFiles } from '@/lib/googleDrive'

/**
 * GET /api/google-drive/files
 * 
 * List all Excel files from Google Drive
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId') || undefined

    const files = await listExcelFiles(folderId)

    return NextResponse.json(
      {
        success: true,
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
        })),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error listing Google Drive files:', error)
    
    // Check if error is due to configuration issues
    const errorMessage = (error.message || '').toLowerCase()
    const errorData = error.response?.data || {}
    const errorCode = errorData.error || ''
    
    // Detect invalid_grant (refresh token issues)
    const isInvalidGrant = errorCode === 'invalid_grant' || errorMessage.includes('invalid_grant')
    
    const isConfigurationError = 
      isInvalidGrant ||
      errorMessage.includes('not configured') ||
      errorMessage.includes('credentials') ||
      errorMessage.includes('decoder') ||
      errorMessage.includes('err_ossl') ||
      errorMessage.includes('unsupported') ||
      errorMessage.includes('refresh token') ||
      errorMessage.includes('authorization') ||
      error.code === 'ERR_OSSL_UNSUPPORTED'
    
    // Provide helpful error message for invalid_grant
    let errorMsg = error.message || 'Failed to list files from Google Drive'
    if (isInvalidGrant) {
      errorMsg = 'Invalid or expired refresh token. Please re-authorize by visiting /api/google-drive/auth and getting a new refresh token.'
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        isConfigurationError,
      },
      { status: 500 }
    )
  }
}
