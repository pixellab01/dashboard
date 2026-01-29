/**
 * Google Drive Integration
 * 
 * Functions to read Excel files from Google Drive
 */

import { google } from 'googleapis'
import * as XLSX from 'xlsx'

// Initialize Google Drive API client
export function getGoogleDriveClient() {
  // Check for OAuth2 credentials (client ID and client secret)
  if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      (() => {
        let redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI
        if (!redirectUri) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NGROK_URL
          if (baseUrl) {
            redirectUri = `${baseUrl}/api/google-drive/callback`
          } else {
            redirectUri = 'http://localhost:3000/api/google-drive/callback'
          }
        }
        if (redirectUri.includes('ngrok') && !redirectUri.startsWith('https://')) {
          redirectUri = redirectUri.replace('http://', 'https://')
        }
        return redirectUri
      })()
    )

    // Set refresh token if available
    if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      })
    } else {
      throw new Error('Google Drive refresh token not configured. Please set GOOGLE_DRIVE_REFRESH_TOKEN in .env.local. You need to complete OAuth2 authorization first.')
    }

    return google.drive({ version: 'v3', auth: oauth2Client })
  }
  
  // Fallback to service account if available
  if (process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      key: process.env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })

    return google.drive({ version: 'v3', auth })
  }

  throw new Error('Google Drive credentials not configured. Please set either:\n' +
    '1. GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN (for OAuth2)\n' +
    '2. GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY (for service account)')
}

/**
 * List Excel files in Google Drive folder
 */
export async function listExcelFiles(folderId?: string) {
  try {
    const drive = getGoogleDriveClient()
    
    // Build query to find Excel files
    let query = "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel' or mimeType='text/csv'"
    
    // Helper function to check if folder ID is valid (not a placeholder)
    const isValidFolderId = (id: string | undefined): boolean => {
      if (!id) return false
      // Ignore placeholder values
      const placeholders = [
        'optional-folder-id-if-you-want-to-limit-to-specific-folder',
        'your-folder-id-here',
        'folder-id',
      ]
      return !placeholders.some(placeholder => id.toLowerCase().includes(placeholder.toLowerCase()))
    }
    
    // Use provided folderId, or fall back to environment variable if valid
    const targetFolderId = folderId || (isValidFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID) ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined)
    
    if (targetFolderId) {
      query += ` and '${targetFolderId}' in parents`
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc',
    })

    return response.data.files || []
  } catch (error) {
    console.error('Error listing Excel files from Google Drive:', error)
    throw error
  }
}

/**
 * Read Excel file from Google Drive by file ID
 */
export async function readExcelFileFromDrive(fileId: string) {
  try {
    const drive = getGoogleDriveClient()
    
    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType',
    })

    // Download file content
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    const buffer = Buffer.from(response.data as ArrayBuffer)
    const fileName = fileMetadata.data.name || 'file.xlsx'
    
    // Determine file type
    const mimeType = fileMetadata.data.mimeType || ''
    let fileType = 'xlsx'
    if (mimeType.includes('csv') || fileName.endsWith('.csv')) {
      fileType = 'csv'
    } else if (mimeType.includes('ms-excel') || fileName.endsWith('.xls')) {
      fileType = 'xls'
    }

    // Parse Excel file
    let workbook: XLSX.WorkBook
    if (fileType === 'csv') {
      const csvString = buffer.toString('utf-8')
      workbook = XLSX.read(csvString, { type: 'string' })
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    }

    return {
      workbook,
      fileName,
      fileType,
    }
  } catch (error) {
    console.error('Error reading Excel file from Google Drive:', error)
    throw error
  }
}

/**
 * Parse Excel file and return structured data
 */
export function parseExcelData(workbook: XLSX.WorkBook) {
  // Get the first sheet
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Convert sheet to JSON with proper handling
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Use first row as header
    defval: null,
    raw: false, // Convert values to strings
  })

  if (!jsonData || jsonData.length === 0) {
    throw new Error('File is empty or could not be parsed')
  }

  // Extract headers (first row) and clean them
  const rawHeaders = jsonData[0] as any[]
  const headers = rawHeaders.map((header, index) => {
    const cleanHeader = String(header || `Column${index + 1}`).trim()
    return cleanHeader || `Column${index + 1}`
  })

  // Convert rows to objects with column names as keys
  const rows = jsonData.slice(1) as any[][]
  const result: Record<string, any>[] = []
  const seenRowHashes = new Set<string>() // To track exact duplicate rows

  rows.forEach((row, rowIndex) => {
    const rowObject: Record<string, any> = {}
    let rowString = '' // For duplicate detection

    // Process each column
    headers.forEach((header, colIndex) => {
      const value = row[colIndex]
      
      // Handle missing or empty values
      if (value === null || value === undefined || value === '') {
        rowObject[header] = 'none'
      } else {
        // Convert to string and trim
        const stringValue = String(value).trim()
        rowObject[header] = stringValue || 'none'
      }
      
      // Build row string for duplicate detection (sorted for consistency)
      rowString += `${header}:${rowObject[header]}|`
    })

    // Create a normalized hash of the entire row for duplicate detection
    // Sort entries to ensure consistent hashing regardless of column order
    const sortedEntries = Object.entries(rowObject)
      .sort(([a], [b]) => a.localeCompare(b))
    const rowHash = sortedEntries
      .map(([k, v]) => `${k}:${v}`)
      .join('|')

    // Check for exact duplicates - only remove if the entire row is identical
    // This ensures that rows with the same Order ID but different data are kept
    if (!seenRowHashes.has(rowHash)) {
      seenRowHashes.add(rowHash)
      result.push(rowObject)
    } else {
      // Log duplicate removal for debugging (only if DEBUG_ANALYTICS is enabled)
      if (process.env.DEBUG_ANALYTICS === 'true') {
        const status = rowObject['Status'] || rowObject['status'] || ''
        if (status && status.toUpperCase().includes('RTO DELIVERED')) {
          const orderId = rowObject['Order ID'] || rowObject['order id'] || rowObject['Order ID'] || 'N/A'
          console.log(`[Duplicate Removed] Row ${rowIndex + 2}: Order ID ${orderId}, Status: ${status}`)
        }
      }
    }
  })

  // Ensure all rows have all columns (fill missing columns with 'none')
  const finalResult = result.map((row) => {
    const completeRow: Record<string, any> = {}
    headers.forEach((header) => {
      completeRow[header] = row[header] !== undefined ? row[header] : 'none'
    })
    return completeRow
  })

  return {
    data: finalResult,
    headers,
    totalRows: finalResult.length,
    originalRows: rows.length,
    duplicatesRemoved: rows.length - finalResult.length,
  }
}
