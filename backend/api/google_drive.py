"""
Google Drive API endpoints
"""
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from backend.services.google_drive_service import get_google_drive_service
from backend.redis_client import save_shipping_data_to_redis, generate_session_id
from backend.rq_queue import enqueue_analytics_computation
from backend.utils.preprocessing import preprocess_shipping_detail

router = APIRouter(prefix="/api/google-drive", tags=["google-drive"])


class ReadFileRequest(BaseModel):
    fileId: str
    sheetType: Optional[str] = "shipping"


@router.get("/auth")
async def get_auth_url():
    """
    GET /api/google-drive/auth
    Get OAuth2 authorization URL for Google Drive
    """
    try:
        service = get_google_drive_service()
        auth_url = service.generate_auth_url()
        
        redirect_uri = service._get_redirect_uri()
        
        return {
            "success": True,
            "authUrl": auth_url,
            "redirectUri": redirect_uri,
            "message": "Visit the authUrl to authorize and get refresh token",
            "instructions": f"Make sure this redirect URI is added to your Google Cloud Console OAuth2 credentials: {redirect_uri}"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error generating auth URL: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate authorization URL: {str(e)}"
        )


@router.get("/callback")
async def oauth_callback(code: Optional[str] = Query(None), format: Optional[str] = Query(None)):
    """
    GET /api/google-drive/callback
    OAuth2 callback handler - exchanges authorization code for refresh token
    """
    try:
        if not code:
            raise HTTPException(
                status_code=400,
                detail="Authorization code not provided"
            )
        
        service = get_google_drive_service()
        tokens = service.exchange_code_for_token(code)
        
        json_response = {
            "success": True,
            "refreshToken": tokens["refresh_token"],
            "accessToken": tokens["access_token"],
            "message": "Add this refresh token to your .env.local file as GOOGLE_DRIVE_REFRESH_TOKEN",
        }
        
        # Return HTML if format is not json
        if format != "json":
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Drive Authorization Success</title>
                <style>
                    body {{
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: #f5f5f5;
                    }}
                    .container {{
                        background: white;
                        padding: 30px;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }}
                    h1 {{
                        color: #34a853;
                        margin-top: 0;
                    }}
                    .token-box {{
                        background: #f8f9fa;
                        border: 2px solid #e0e0e0;
                        border-radius: 4px;
                        padding: 15px;
                        margin: 20px 0;
                        word-break: break-all;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                    }}
                    .copy-btn {{
                        background: #4285f4;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 10px;
                        font-size: 14px;
                    }}
                    .copy-btn:hover {{
                        background: #357ae8;
                    }}
                    .instructions {{
                        background: #e8f5e9;
                        border-left: 4px solid #34a853;
                        padding: 15px;
                        margin: 20px 0;
                    }}
                    .instructions ol {{
                        margin: 10px 0;
                        padding-left: 20px;
                    }}
                    .instructions li {{
                        margin: 8px 0;
                    }}
                    .success-icon {{
                        font-size: 48px;
                        text-align: center;
                        margin: 20px 0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h1>Authorization Successful!</h1>
                    <p>Your Google Drive has been successfully authorized. Copy the refresh token below and add it to your <code>.env.local</code> file.</p>
                    
                    <div class="token-box">
                        <strong>Refresh Token:</strong><br>
                        <span id="refreshToken">{tokens["refresh_token"]}</span>
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
                    function copyToken() {{
                        const token = document.getElementById('refreshToken').textContent;
                        navigator.clipboard.writeText(token).then(() => {{
                            const btn = event.target;
                            const originalText = btn.textContent;
                            btn.textContent = 'Copied!';
                            btn.style.background = '#34a853';
                            setTimeout(() => {{
                                btn.textContent = originalText;
                                btn.style.background = '#4285f4';
                            }}, 2000);
                        }});
                    }}
                </script>
            </body>
            </html>
            """
            return HTMLResponse(content=html_content)
        
        return json_response
    except ValueError as e:
        error_msg = str(e)
        if "redirect_uri_mismatch" in error_msg.lower():
            service = get_google_drive_service()
            redirect_uri = service._get_redirect_uri()
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Redirect URI mismatch",
                    "message": f"The redirect URI {redirect_uri} is not registered in your Google Cloud Console.",
                    "instructions": [
                        "1. Go to Google Cloud Console > APIs & Services > Credentials",
                        "2. Click on your OAuth 2.0 Client ID",
                        f"3. Add this URI to 'Authorized redirect URIs': {redirect_uri}",
                        "4. Save and try again",
                    ]
                }
            )
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        print(f"Error exchanging code for token: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to exchange authorization code: {str(e)}"
        )


@router.get("/files")
async def list_files(folderId: Optional[str] = Query(None)):
    """
    GET /api/google-drive/files
    List all Excel files from Google Drive
    """
    try:
        service = get_google_drive_service()
        files = service.list_excel_files(folderId)
        
        return {
            "success": True,
            "files": [
                {
                    "id": file["id"],
                    "name": file["name"],
                    "mimeType": file.get("mimeType", ""),
                    "modifiedTime": file.get("modifiedTime", "")
                }
                for file in files
            ]
        }
    except ValueError as e:
        error_msg = str(e).lower()
        is_config_error = (
            "not configured" in error_msg or
            "credentials" in error_msg or
            "invalid_grant" in error_msg or
            "refresh token" in error_msg
        )
        
        detail_msg = str(e)
        if "invalid_grant" in error_msg:
            detail_msg = "Invalid or expired refresh token. Please re-authorize by visiting /api/google-drive/auth and getting a new refresh token."
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": detail_msg,
                "isConfigurationError": is_config_error
            }
        )
    except Exception as e:
        print(f"Error listing Google Drive files: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list files from Google Drive: {str(e)}"
        )


@router.post("/read")
async def read_file(request: ReadFileRequest):
    """
    POST /api/google-drive/read
    Read and parse Excel file from Google Drive and save to Redis
    """
    try:
        if not request.fileId:
            raise HTTPException(
                status_code=400,
                detail="File ID is required"
            )
        
        # Only process shipping files
        if request.sheetType != "shipping":
            return {
                "success": True,
                "message": f"File parsed successfully ({request.sheetType} type - not saved to Redis)"
            }
        
        # Read file from Google Drive
        service = get_google_drive_service()
        file_data = service.read_excel_file(request.fileId)
        
        # Preprocess and normalize data
        processed_data = [
            preprocess_shipping_detail(row)
            for row in file_data["data"]
        ]
        
        # Generate session ID
        session_id = generate_session_id()
        
        # Save to Redis with 30 minute TTL
        save_shipping_data_to_redis(processed_data, session_id)
        
        # Enqueue analytics computation job (non-blocking)
        try:
            job = enqueue_analytics_computation(session_id, 10)  # Priority 10
            print(f"📋 Analytics computation job queued: {job.id if job else 'N/A'} for session {session_id}")
        except Exception as e:
            print(f"Error enqueueing analytics job: {e}")
            # Don't fail the request - analytics will be computed on-demand if needed
        
        return {
            "success": True,
            "fileName": file_data["fileName"],
            "totalRows": file_data["totalRows"],
            "originalRows": file_data["originalRows"],
            "duplicatesRemoved": file_data["duplicatesRemoved"],
            "headers": file_data["headers"],
            "totalColumns": len(file_data["headers"]),
            "sessionId": session_id,
            "sheetType": request.sheetType or "shipping",
            "message": f'File "{file_data["fileName"]}" parsed successfully and saved to Redis (30 min TTL). Analytics computation job queued.'
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error reading Excel file from Google Drive: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file from Google Drive: {str(e)}"
        )
