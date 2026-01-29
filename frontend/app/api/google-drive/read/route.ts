import { NextRequest, NextResponse } from 'next/server'
import { readExcelFileFromDrive, parseExcelData } from '@/lib/googleDrive'
import { saveShippingDataToRedis, generateSessionId } from '@/lib/redis'
import { preprocessShippingDetail } from '@/lib/dataPreprocessing'
import { enqueueAnalyticsComputation } from '@/lib/queue'

/**
 * POST /api/google-drive/read
 * 
 * Read and parse Excel file from Google Drive and save to Redis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileId, sheetType } = body

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    // Only process shipping files
    if (sheetType !== 'shipping') {
      return NextResponse.json(
        {
          success: true,
          message: `File parsed successfully (${sheetType} type - not saved to Redis)`,
        },
        { status: 200 }
      )
    }

    // Read file from Google Drive
    const { workbook, fileName } = await readExcelFileFromDrive(fileId)

    // Parse Excel data
    const parsedData = parseExcelData(workbook)

    // Preprocess and normalize data
    const processedData = parsedData.data.map((row: any) => preprocessShippingDetail(row))

    // Generate session ID
    const sessionId = generateSessionId()

    // Save to Redis with 30 minute TTL
    await saveShippingDataToRedis(processedData, sessionId)

    // 🔥 Enqueue analytics computation job (non-blocking)
    // Job will be processed by worker process in background
    // This pre-computes all analytics so APIs can fetch instantly from Redis
    try {
      const job = await enqueueAnalyticsComputation(sessionId, 10) // Priority 10
      console.log(`📋 Analytics computation job queued: ${job.id} for session ${sessionId}`)
    } catch (error) {
      console.error('Error enqueueing analytics job:', error)
      // Don't fail the request - analytics will be computed on-demand if needed
    }

    return NextResponse.json(
      {
        success: true,
        fileName,
        totalRows: parsedData.totalRows,
        originalRows: parsedData.originalRows,
        duplicatesRemoved: parsedData.duplicatesRemoved,
        headers: parsedData.headers,
        totalColumns: parsedData.headers.length,
        sessionId,
        sheetType: sheetType || 'shipping',
        message: `File "${fileName}" parsed successfully and saved to Redis (30 min TTL). Analytics computation job queued.`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error reading Excel file from Google Drive:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to read file from Google Drive',
      },
      { status: 500 }
    )
  }
}
