"""
Google Drive API endpoints
"""
from fastapi import APIRouter, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from backend.services.google_drive_service import get_google_drive_service
from backend.data_loader import load_data_from_dataframe
from backend.config import GOOGLE_DRIVE_FOLDER_ID
import pandas as pd
import uuid

router = APIRouter(prefix="/api/google-drive", tags=["google-drive"])


class ReadFileRequest(BaseModel):
    fileId: str
    sheetType: Optional[str] = "shipping"


def process_drive_file_in_background(file_id: str, session_id: str):
    """
    Background task to download, read, and process a file from Google Drive.
    """
    print(f"[{session_id}] Starting background processing for file_id: {file_id}")
    try:
        service = get_google_drive_service()
        
        # Download and read the file content into a pandas DataFrame
        df = service.read_file_to_dataframe(file_id)
        if df is None:
            raise ValueError("Failed to read file into DataFrame.")

        # Process and store the data
        # This function now handles preprocessing and saving to Parquet/Redis
        load_data_from_dataframe(df, session_id)

        print(f"[{session_id}] Background processing completed successfully.")
    except Exception as e:
        print(f"❌ [{session_id}] Error in background task: {e}")
        # Here you could update the session in Redis to reflect the error status
        # from backend.utils.redis import get_redis_client
        # redis = get_redis_client()
        # redis.hset(f"session:{session_id}", "status", "error")
        # redis.hset(f"session:{session_id}", "error_message", str(e))

@router.post("/read")
async def read_file(request: ReadFileRequest, background_tasks: BackgroundTasks):
    """
    POST /api/google-drive/read
    Initiates a background task to read and process a file from Google Drive.
    """
    try:
        session_id = f"session_{uuid.uuid4().hex}"
        
        # Add the long-running task to the background
        background_tasks.add_task(
            process_drive_file_in_background,
            request.fileId,
            session_id
        )
        
        # Immediately return a response to the client
        return {
            "success": True,
            "sessionId": session_id,
            "message": "File processing has started in the background. "
                       "You can use the session ID to check the status and fetch results."
        }
    except Exception as e:
        print(f"Error initiating file read: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start file processing: {str(e)}"
        )


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
    
    Query Parameters:
        folderId: Optional folder ID to limit search to a specific folder
    """
    try:
        service = get_google_drive_service()
        files = service.list_excel_files(folderId)
        
        # Provide helpful message if no files found
        if len(files) == 0:
            target_folder = folderId or GOOGLE_DRIVE_FOLDER_ID
            if target_folder:
                return {
                    "success": True,
                    "files": [],
                    "message": f"No Excel files found in the specified folder (ID: {target_folder}). "
                               f"Please check:\n"
                               f"1. The folder ID is correct\n"
                               f"2. The folder contains Excel (.xlsx, .xls) or CSV files\n"
                               f"3. Your Google account has access to the folder\n"
                               f"4. Try calling without folderId parameter to search all files",
                    "folderId": target_folder
                }
            else:
                return {
                    "success": True,
                    "files": [],
                    "message": "No Excel files found in your Google Drive. "
                               "Please ensure:\n"
                               "1. You have Excel (.xlsx, .xls) or CSV files in your Drive\n"
                               "2. Your Google account has proper permissions\n"
                               "3. The files are not in Trash"
                }
        
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
    
    Query Parameters:
        folderId: Optional folder ID to limit search to a specific folder
    """
    try:
        service = get_google_drive_service()
        files = service.list_excel_files(folderId)
        
        # Provide helpful message if no files found
        if len(files) == 0:
            target_folder = folderId or GOOGLE_DRIVE_FOLDER_ID
            if target_folder:
                return {
                    "success": True,
                    "files": [],
                    "message": f"No Excel files found in the specified folder (ID: {target_folder}). "
                               f"Please check:\n"
                               f"1. The folder ID is correct\n"
                               f"2. The folder contains Excel (.xlsx, .xls) or CSV files\n"
                               f"3. Your Google account has access to the folder\n"
                               f"4. Try calling without folderId parameter to search all files",
                    "folderId": target_folder
                }
            else:
                return {
                    "success": True,
                    "files": [],
                    "message": "No Excel files found in your Google Drive. "
                               "Please ensure:\n"
                               "1. You have Excel (.xlsx, .xls) or CSV files in your Drive\n"
                               "2. Your Google account has proper permissions\n"
                               "3. The files are not in Trash"
                }
        
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
    
    Query Parameters:
        folderId: Optional folder ID to limit search to a specific folder
    """
    try:
        service = get_google_drive_service()
        files = service.list_excel_files(folderId)
        
        # Provide helpful message if no files found
        if len(files) == 0:
            target_folder = folderId or GOOGLE_DRIVE_FOLDER_ID
            if target_folder:
                return {
                    "success": True,
                    "files": [],
                    "message": f"No Excel files found in the specified folder (ID: {target_folder}). "
                               f"Please check:\n"
                               f"1. The folder ID is correct\n"
                               f"2. The folder contains Excel (.xlsx, .xls) or CSV files\n"
                               f"3. Your Google account has access to the folder\n"
                               f"4. Try calling without folderId parameter to search all files",
                    "folderId": target_folder
                }
            else:
                return {
                    "success": True,
                    "files": [],
                    "message": "No Excel files found in your Google Drive. "
                               "Please ensure:\n"
                               "1. You have Excel (.xlsx, .xls) or CSV files in your Drive\n"
                               "2. Your Google account has proper permissions\n"
                               "3. The files are not in Trash"
                }
        
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
