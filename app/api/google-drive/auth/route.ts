import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

/**
 * GET /api/google-drive/auth
 * 
 * Get OAuth2 authorization URL for Google Drive
 */
export async function GET(request: NextRequest) {
  try {
    if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Drive client ID and client secret not configured',
        },
        { status: 400 }
      )
    }

    // Support ngrok or custom URLs via environment variable
    let redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI
    
    if (!redirectUri) {
      // Check if we have a base URL set
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NGROK_URL
      if (baseUrl) {
        redirectUri = `${baseUrl}/api/google-drive/callback`
      } else {
        redirectUri = 'http://localhost:3001/api/google-drive/callback'
      }
    }
    
    // Ensure redirect URI uses https for ngrok
    if (redirectUri.includes('ngrok') && !redirectUri.startsWith('https://')) {
      redirectUri = redirectUri.replace('http://', 'https://')
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      redirectUri
    )

    const scopes = ['https://www.googleapis.com/auth/drive.readonly']

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    })

    return NextResponse.json(
      {
        success: true,
        authUrl,
        redirectUri,
        message: 'Visit the authUrl to authorize and get refresh token',
        instructions: `Make sure this redirect URI is added to your Google Cloud Console OAuth2 credentials: ${redirectUri}`,
      },
      { status: 200 }
    )
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
