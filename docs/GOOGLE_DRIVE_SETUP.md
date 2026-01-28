# Google Drive Integration Setup Guide

This application now reads Excel files directly from Google Drive instead of storing them in MongoDB. MongoDB is used only for user authentication and analytics results caching.

## Prerequisites

1. A Google Cloud Project with Google Drive API enabled
2. Either:
   - **Option A:** OAuth2 credentials (Client ID and Client Secret) - Recommended for personal accounts
   - **Option B:** Service account credentials (Client Email and Private Key) - Recommended for organization accounts
3. Excel files stored in a Google Drive folder

## Setup Methods

### Method 1: OAuth2 (Client ID & Client Secret)

If you have Client ID and Client Secret, use this method:

#### Step 1: Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen first
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/google-drive/callback` (or your production URL)
   - Click "Create"
   - Copy the Client ID and Client Secret

#### Step 2: Get Refresh Token

1. Add to your `.env.local`:
```env
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
```

2. Start your development server:
```bash
npm run dev
```

3. Get authorization URL:
   - Visit: `http://localhost:3000/api/google-drive/auth`
   - Copy the `authUrl` from the response

4. Authorize access:
   - Open the `authUrl` in your browser
   - Sign in with your Google account
   - Grant permissions to access Google Drive
   - You'll be redirected to the callback URL

5. Get refresh token:
   - After authorization, check the callback response
   - Copy the `refreshToken` value

6. Add refresh token to `.env.local`:
```env
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
```

7. Restart your development server

#### Step 3: Configure Environment Variables

Add to your `.env.local`:
```env
# Google Drive OAuth2 Configuration
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
GOOGLE_DRIVE_FOLDER_ID=optional-folder-id-if-you-want-to-limit-to-specific-folder
```

**Note:** The refresh token is long-lived and doesn't expire unless revoked. Keep it secure!

---

### Method 2: Service Account (Client Email & Private Key)

If you have Service Account credentials, use this method:

#### Step 1: Create Google Cloud Project and Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `dashboard-service-account`
   - Description: `Service account for Dashboard Google Drive access`
4. Click "Create and Continue"
5. Skip role assignment (or assign minimal roles)
6. Click "Done"

### 3. Generate Service Account Key

1. Click on the created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the JSON key file

### 4. Share Google Drive Folder with Service Account

1. Open Google Drive and navigate to the folder containing your Excel files
2. Right-click the folder > "Share"
3. Add the service account email (found in the JSON key file as `client_email`)
4. Give it "Viewer" permissions
5. Click "Send"

**Note:** If you want to read files from the entire Drive, share the root folder or individual files with the service account.

#### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Google Drive Service Account Configuration
GOOGLE_DRIVE_CLIENT_EMAIL=your-service-account-email@project-id.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=optional-folder-id-if-you-want-to-limit-to-specific-folder
```

**Important Notes:**
- Copy the `client_email` from the downloaded JSON key file
- Copy the `private_key` from the downloaded JSON key file
- Keep the `\n` characters in the private key (they represent newlines)
- The private key should be wrapped in quotes
- `GOOGLE_DRIVE_FOLDER_ID` is optional - if not set, the app will search all accessible files

#### Step 3: Install Dependencies

```bash
npm install
```

This will install the `googleapis` package required for Google Drive integration.

## Usage

### Reading Files from Google Drive

1. Login to the Admin Dashboard
2. The dashboard will automatically list all Excel files from your Google Drive
3. Click "Read as Shipping" or "Read as Meta" to parse a file
4. Files are read directly from Google Drive - no data is stored in MongoDB

### Computing Analytics

1. Select a file from Google Drive (or use the first file automatically)
2. Click "Compute Analytics" button
3. Analytics are computed in-memory from the Google Drive file
4. Only analytics results are stored in MongoDB (not the raw Excel data)

## API Endpoints

### List Google Drive Files
```
GET /api/google-drive/files
```

### Read Excel File from Google Drive
```
POST /api/google-drive/read
Body: { fileId: "google-drive-file-id", sheetType: "shipping" }
```

### Compute Analytics
```
POST /api/analytics/compute
Body: { fileId: "google-drive-file-id", sheetType: "shipping" }
```

## Troubleshooting

### "Google Drive credentials not configured" Error
- **For OAuth2:** Ensure `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN` are set
- **For Service Account:** Ensure `GOOGLE_DRIVE_CLIENT_EMAIL` and `GOOGLE_DRIVE_PRIVATE_KEY` are set
- Restart your development server after adding environment variables

### "Refresh token not configured" Error (OAuth2)
- Complete the OAuth2 authorization flow to get a refresh token
- Visit `/api/google-drive/auth` to get the authorization URL
- After authorization, add the refresh token to `.env.local`

### "DECODER routines::unsupported" Error
- This usually means you're using OAuth2 credentials but the code is trying to use service account format
- Ensure you have `GOOGLE_DRIVE_REFRESH_TOKEN` set (not `GOOGLE_DRIVE_PRIVATE_KEY`)
- Or switch to service account credentials if you prefer

### "No Excel files found" Message
- Verify the service account email has access to the Google Drive folder
- Check that the folder contains Excel files (.xlsx, .xls, or .csv)
- Try refreshing the file list

### "Failed to read file from Google Drive" Error
- Ensure the service account has "Viewer" permissions on the file/folder
- Verify the file ID is correct
- Check that the file is an Excel file format

### Private Key Format Issues
- Ensure the private key includes `\n` characters for newlines
- Wrap the entire private key in quotes
- The key should start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----`

## Security Notes

- Never commit the service account JSON key file to version control
- Keep your `.env.local` file secure and never commit it
- Use environment variables in production (e.g., Vercel Environment Variables)
- The service account should have minimal permissions (Viewer access only)

## MongoDB Collections

After migration, MongoDB is used only for:
- `users` - User authentication data
- `analytics_*` - Cached analytics results (not raw Excel data)
- `analytics_metadata` - Analytics computation metadata

The following collections are no longer used:
- `shipping_details`
- `meta_campaign_details`
- `google_sheet_details`

You can safely delete these collections if they exist.
