"""
Google Drive Service
Handles all Google Drive API operations
"""
import os
from typing import Optional, List, Dict, Any
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import pandas as pd
from backend.config import (
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET,
    GOOGLE_DRIVE_REDIRECT_URI,
    GOOGLE_DRIVE_REFRESH_TOKEN,
    GOOGLE_DRIVE_CLIENT_EMAIL,
    GOOGLE_DRIVE_PRIVATE_KEY,
    GOOGLE_DRIVE_FOLDER_ID
)


class GoogleDriveService:
    """Google Drive API service"""
    
    def __init__(self):
        self._service = None
        self._credentials = None
    
    def _get_oauth2_credentials(self) -> Optional[Credentials]:
        """Get OAuth2 credentials"""
        if not GOOGLE_DRIVE_CLIENT_ID or not GOOGLE_DRIVE_CLIENT_SECRET:
            return None
        
        credentials = Credentials(
            token=None,
            refresh_token=GOOGLE_DRIVE_REFRESH_TOKEN,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=GOOGLE_DRIVE_CLIENT_ID,
            client_secret=GOOGLE_DRIVE_CLIENT_SECRET
        )
        
        # Refresh token if needed
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        
        return credentials
    
    def _get_service_account_credentials(self):
        """Get service account credentials"""
        if not GOOGLE_DRIVE_CLIENT_EMAIL or not GOOGLE_DRIVE_PRIVATE_KEY:
            return None
        
        from google.oauth2 import service_account
        import json
        
        # Parse private key
        private_key = GOOGLE_DRIVE_PRIVATE_KEY.replace('\\n', '\n')
        
        credentials_dict = {
            "type": "service_account",
            "client_email": GOOGLE_DRIVE_CLIENT_EMAIL,
            "private_key": private_key,
            "token_uri": "https://oauth2.googleapis.com/token"
        }
        
        credentials = service_account.Credentials.from_service_account_info(
            credentials_dict,
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
        
        return credentials
    
    def get_service(self):
        """Get Google Drive service instance"""
        if self._service is not None:
            return self._service
        
        # Try OAuth2 first
        credentials = self._get_oauth2_credentials()
        
        # Fallback to service account
        if not credentials:
            credentials = self._get_service_account_credentials()
        
        if not credentials:
            raise ValueError(
                "Google Drive credentials not configured. Please set either:\n"
                "1. GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN (for OAuth2)\n"
                "2. GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY (for service account)"
            )
        
        self._credentials = credentials
        self._service = build('drive', 'v3', credentials=credentials)
        return self._service
    
    def list_excel_files(self, folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all Excel files from Google Drive
        
        Args:
            folder_id: Optional folder ID to limit search. If None, searches all accessible files.
        
        Returns:
            List of file dictionaries with id, name, mimeType, modifiedTime
        """
        service = self.get_service()
        
        # Build query for Excel/CSV files
        query = (
            "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' "
            "or mimeType='application/vnd.ms-excel' "
            "or mimeType='text/csv'"
        )
        
        # Use provided folder_id or fallback to environment variable
        target_folder_id = folder_id or GOOGLE_DRIVE_FOLDER_ID
        
        # Check if folder_id is valid (not a placeholder)
        if target_folder_id:
            placeholders = [
                'optional-folder-id-if-you-want-to-limit-to-specific-folder',
                'your-folder-id-here',
                'folder-id',
            ]
            is_valid = not any(ph in target_folder_id.lower() for ph in placeholders)
            
            if is_valid:
                query += f" and '{target_folder_id}' in parents"
                print(f"[Google Drive] Searching for Excel files in folder: {target_folder_id}")
            else:
                print(f"[Google Drive] Invalid folder ID placeholder detected, searching all files")
        else:
            print(f"[Google Drive] No folder ID specified, searching all accessible Excel files")
        
        try:
            # List files
            results = service.files().list(
                q=query,
                fields="files(id, name, mimeType, modifiedTime)",
                orderBy="modifiedTime desc",
                pageSize=100  # Increase page size to get more results
            ).execute()
            
            files = results.get('files', [])
            print(f"[Google Drive] Found {len(files)} Excel/CSV file(s)")
            
            # If no files found and folder_id is set, try searching without folder restriction
            if len(files) == 0 and target_folder_id and is_valid:
                print(f"[Google Drive] No files found in folder {target_folder_id}, trying to search all files...")
                # Try without folder restriction
                query_all = (
                    "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' "
                    "or mimeType='application/vnd.ms-excel' "
                    "or mimeType='text/csv'"
                )
                results_all = service.files().list(
                    q=query_all,
                    fields="files(id, name, mimeType, modifiedTime)",
                    orderBy="modifiedTime desc",
                    pageSize=100
                ).execute()
                files_all = results_all.get('files', [])
                print(f"[Google Drive] Found {len(files_all)} Excel/CSV file(s) in all accessible locations")
                
                if len(files_all) > 0:
                    print(f"[Google Drive] Warning: Files exist but not in specified folder. Check folder ID or permissions.")
                    # Return empty list to indicate folder-specific search failed
                    # User can try without folder_id parameter
                    return []
            
            return files
            
        except Exception as e:
            print(f"[Google Drive] Error listing files: {e}")
            raise
    
    def read_excel_file(self, file_id: str) -> Dict[str, Any]:
        """
        Read Excel file from Google Drive and parse it
        Returns: {
            'workbook': openpyxl workbook object,
            'fileName': str,
            'fileType': str,
            'data': List[Dict],
            'headers': List[str],
            'totalRows': int,
            'originalRows': int,
            'duplicatesRemoved': int
        }
        """
        service = self.get_service()
        
        # Get file metadata
        file_metadata = service.files().get(fileId=file_id, fields='id, name, mimeType').execute()
        file_name = file_metadata.get('name', 'file.xlsx')
        mime_type = file_metadata.get('mimeType', '')
        
        # Download file content
        request = service.files().get_media(fileId=file_id)
        file_content = io.BytesIO()
        downloader = MediaIoBaseDownload(file_content, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        file_content.seek(0)
        
        # Determine file type
        if 'csv' in mime_type or file_name.endswith('.csv'):
            file_type = 'csv'
        elif 'ms-excel' in mime_type or file_name.endswith('.xls'):
            file_type = 'xls'
        else:
            file_type = 'xlsx'
        
        # Parse file
        if file_type == 'csv':
            # Use low_memory=False to avoid DtypeWarning for mixed types
            # This reads the entire file into memory for accurate type inference
            df = pd.read_csv(file_content, low_memory=False)
        elif file_type == 'xls':
            df = pd.read_excel(file_content, engine='xlrd')
        else:
            df = pd.read_excel(file_content, engine='openpyxl')
        
        # Parse and clean data
        parsed_data = self._parse_excel_data(df)
        
        return {
            'fileName': file_name,
            'fileType': file_type,
            **parsed_data
        }
    
    def _parse_excel_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Parse Excel DataFrame and return structured data
        """
        if df.empty:
            raise ValueError('File is empty or could not be parsed')
        
        # Clean headers
        headers = [str(h).strip() if pd.notna(h) else f'Column{i+1}' 
                  for i, h in enumerate(df.columns)]
        
        # Replace empty headers
        headers = [h if h else f'Column{i+1}' for i, h in enumerate(headers)]
        
        # Convert to records
        original_rows = len(df)
        df = df.fillna('none')
        
        # Remove duplicates (exact row matches)
        df = df.drop_duplicates()
        duplicates_removed = original_rows - len(df)
        
        # Convert to list of dicts
        data = df.to_dict('records')
        
        # Ensure all rows have all columns
        for row in data:
            for header in headers:
                if header not in row:
                    row[header] = 'none'
        
        return {
            'data': data,
            'headers': headers,
            'totalRows': len(data),
            'originalRows': original_rows,
            'duplicatesRemoved': duplicates_removed
        }
    
    def _get_redirect_uri(self, redirect_uri: Optional[str] = None) -> str:
        """Get redirect URI"""
        redirect = redirect_uri or GOOGLE_DRIVE_REDIRECT_URI
        
        if not redirect:
            base_url = os.getenv("NEXT_PUBLIC_BASE_URL") or os.getenv("NGROK_URL")
            if base_url:
                redirect = f"{base_url}/api/google-drive/callback"
            else:
                redirect = "http://localhost:8000/api/google-drive/callback"
        
        # Ensure https for ngrok
        if 'ngrok' in redirect and not redirect.startswith('https://'):
            redirect = redirect.replace('http://', 'https://')
        
        return redirect
    
    def generate_auth_url(self, redirect_uri: Optional[str] = None) -> str:
        """
        Generate OAuth2 authorization URL
        """
        if not GOOGLE_DRIVE_CLIENT_ID or not GOOGLE_DRIVE_CLIENT_SECRET:
            raise ValueError("Google Drive client ID and client secret not configured")
        
        redirect = self._get_redirect_uri(redirect_uri)
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_DRIVE_CLIENT_ID,
                    "client_secret": GOOGLE_DRIVE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect]
                }
            },
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
        flow.redirect_uri = redirect
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            prompt='consent'  # Force consent to get refresh token
        )
        
        return auth_url
    
    def exchange_code_for_token(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, str]:
        """
        Exchange authorization code for refresh token
        """
        if not GOOGLE_DRIVE_CLIENT_ID or not GOOGLE_DRIVE_CLIENT_SECRET:
            raise ValueError("Google Drive client ID and client secret not configured")
        
        redirect = self._get_redirect_uri(redirect_uri)
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_DRIVE_CLIENT_ID,
                    "client_secret": GOOGLE_DRIVE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect]
                }
            },
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
        flow.redirect_uri = redirect
        
        flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        if not credentials.refresh_token:
            raise ValueError(
                "Refresh token not received. Please revoke access and try again with prompt=consent"
            )
        
        return {
            'refresh_token': credentials.refresh_token,
            'access_token': credentials.token
        }


# Singleton instance
_google_drive_service: Optional[GoogleDriveService] = None


def get_google_drive_service() -> GoogleDriveService:
    """Get Google Drive service instance"""
    global _google_drive_service
    if _google_drive_service is None:
        _google_drive_service = GoogleDriveService()
    return _google_drive_service
