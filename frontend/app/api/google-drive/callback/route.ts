import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

/**
 * GET /api/google-drive/callback
 * 
 * OAuth2 callback handler - exchanges authorization code for refresh token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization code not provided',
        },
        { status: 400 }
      )
    }

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

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Refresh token not received. Please revoke access and try again with prompt=consent',
          accessToken: tokens.access_token,
        },
        { status: 400 }
      )
    }

    // Return both JSON and HTML response
    const jsonResponse = {
      success: true,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      message: 'Add this refresh token to your .env.local file as GOOGLE_DRIVE_REFRESH_TOKEN',
    }

    // Create user-friendly HTML page
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Authorization Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #34a853;
            margin-top: 0;
          }
          .token-box {
            background: #f8f9fa;
            border: 2px solid #e0e0e0;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            position: relative;
          }
          .copy-btn {
            background: #4285f4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
            font-size: 14px;
          }
          .copy-btn:hover {
            background: #357ae8;
          }
          .instructions {
            background: #e8f5e9;
            border-left: 4px solid #34a853;
            padding: 15px;
            margin: 20px 0;
          }
          .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .instructions li {
            margin: 8px 0;
          }
          .success-icon {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authorization Successful!</h1>
          <p>Your Google Drive has been successfully authorized. Copy the refresh token below and add it to your <code>.env.local</code> file.</p>
          
          <div class="token-box">
            <strong>Refresh Token:</strong><br>
            <span id="refreshToken">${tokens.refresh_token}</span>
            <br>
            <button class="copy-btn" onclick="copyToken()">Copy Refresh Token</button>
          </div>

          <div class="instructions">
            <strong>Next Steps:</strong>
            <ol>
              <li>Copy the refresh token above</li>
              <li>Open your <code>.env.local</code> file</li>
              <li>Add this line: <code>GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token-here</code></li>
              <li>Replace <code>your-refresh-token-here</code> with the token you copied</li>
              <li>Restart your development server</li>
            </ol>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            <strong>Note:</strong> Keep this refresh token secure. It provides long-term access to your Google Drive.
          </p>
        </div>

        <script>
          function copyToken() {
            const token = document.getElementById('refreshToken').textContent;
            navigator.clipboard.writeText(token).then(() => {
              const btn = event.target;
              const originalText = btn.textContent;
              btn.textContent = 'Copied!';
              btn.style.background = '#34a853';
              setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#4285f4';
              }, 2000);
            });
          }
        </script>
      </body>
      </html>
    `

    // Check if request wants JSON (via Accept header or query param)
    const wantsJson = request.headers.get('accept')?.includes('application/json') || 
                     new URL(request.url).searchParams.get('format') === 'json'

    if (wantsJson) {
      return NextResponse.json(jsonResponse, { status: 200 })
    }

    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error: any) {
    console.error('Error exchanging code for token:', error)
    
    // Check for redirect URI mismatch
    const errorMessage = error.message || ''
    const errorResponse = error.response?.data || {}
    
    if (errorMessage.includes('redirect_uri_mismatch') || errorResponse.error === 'redirect_uri_mismatch') {
      const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/google-drive/callback`
      
      return NextResponse.json(
        {
          success: false,
          error: 'Redirect URI mismatch',
          message: `The redirect URI ${redirectUri} is not registered in your Google Cloud Console.`,
          instructions: [
            '1. Go to Google Cloud Console > APIs & Services > Credentials',
            '2. Click on your OAuth 2.0 Client ID',
            `3. Add this URI to "Authorized redirect URIs": ${redirectUri}`,
            '4. Save and try again',
          ],
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to exchange authorization code',
      },
      { status: 500 }
    )
  }
}
