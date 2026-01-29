# Backend API

This directory contains all backend code for the Analytics Dashboard, organized into a clean Python FastAPI structure.

## Structure

```
backend/
├── api/                    # API route handlers
│   ├── auth.py            # Authentication endpoints (login)
│   ├── admin.py           # Admin endpoints (queue management)
│   ├── google_drive.py    # Google Drive API endpoints
│   └── stats.py           # Statistics endpoints
├── services/              # Business logic services
│   ├── auth_service.py    # Authentication service
│   └── google_drive_service.py  # Google Drive integration service
├── utils/                 # Utility modules
│   ├── mongodb.py         # MongoDB connection utilities
│   └── preprocessing.py   # Data preprocessing utilities
├── scripts/               # Management scripts
│   └── create_admin.py    # Admin user creation script
├── config.py              # Configuration settings
├── main.py                # FastAPI application entry point
├── analytics.py           # Analytics computation logic
├── data_loader.py         # Data loading utilities
└── data_preprocessing.py  # Data preprocessing functions
```

## API Endpoints

### Authentication (`/api/login`)
- `POST /api/login` - Authenticate user and return user data

### Google Drive (`/api/google-drive`)
- `GET /api/google-drive/auth` - Get OAuth2 authorization URL
- `GET /api/google-drive/callback` - OAuth2 callback handler
- `GET /api/google-drive/files` - List Excel files from Google Drive
- `POST /api/google-drive/read` - Read and parse Excel file from Google Drive

### Admin (`/api/admin`)
- `GET /api/admin/queue` - Queue endpoints have been removed (Redis and RQ removed)

### Stats (`/api/stats`)
- `GET /api/stats` - Get dashboard statistics

### Analytics (`/api/analytics`)
- `POST /api/analytics/compute` - Compute analytics
- `GET /api/analytics/{analytics_type}` - Get computed analytics
- Various specific analytics endpoints (weekly-summary, ndr-weekly, etc.)

## Configuration

All configuration is managed through environment variables loaded from `.env.local`:

- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_DRIVE_CLIENT_ID` - Google Drive OAuth2 client ID
- `GOOGLE_DRIVE_CLIENT_SECRET` - Google Drive OAuth2 client secret
- `GOOGLE_DRIVE_REFRESH_TOKEN` - Google Drive refresh token
- `GOOGLE_DRIVE_REDIRECT_URI` - OAuth2 redirect URI
- `GOOGLE_DRIVE_CLIENT_EMAIL` - Service account email (alternative auth)
- `GOOGLE_DRIVE_PRIVATE_KEY` - Service account private key
- `GOOGLE_DRIVE_FOLDER_ID` - Optional folder ID to limit file search

## Running the Backend

### Development
```bash
python run_backend.py
```

Or directly:
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Creating Admin User
```bash
python -m backend.scripts.create_admin --email admin@example.com --password admin123 --name "Admin User"
```

## Services

### AuthService
Handles user authentication and admin user management.

### GoogleDriveService
Handles all Google Drive API operations including:
- OAuth2 authentication flow
- File listing
- File reading and parsing
- Excel file processing

## Dependencies

See `requirements.txt` in the project root for all dependencies.

Key dependencies:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pymongo` - MongoDB driver
- `google-api-python-client` - Google Drive API
- `pandas` - Data processing
- `openpyxl` - Excel file handling

## Note on Redis Removal

Redis, RQ (job queue), and worker functionality have been completely removed from the backend. Analytics functions now accept data directly as parameters instead of loading from Redis. Endpoints that previously relied on Redis storage will need to be updated to accept data in request bodies.
