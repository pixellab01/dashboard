import { NextRequest, NextResponse } from 'next/server'
import { getShippingDataFromRedis, getAnalyticsFromRedis, saveAnalyticsToRedis, isSourceDataValid } from '@/lib/redis'

/**
 * GET /api/analytics/filter-options
 * 
 * Get unique values for filter dropdowns from Redis data (cached)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const channelFilter = searchParams.get('channel') // Filter SKUs by channel
    const skuFilter = searchParams.get('sku') // Filter products by SKU

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Check if source data is still valid
    const sourceValid = await isSourceDataValid(sessionId)
    if (!sourceValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Source data has expired. Please read the shipping file again.',
        },
        { status: 200 }
      )
    }

    // Build cache key based on filters
    const cacheKey = `filter-options:${channelFilter || 'all'}:${skuFilter || 'all'}`

    // Try to get from cache first
    let cachedResult = await getAnalyticsFromRedis(sessionId, cacheKey)
    if (cachedResult) {
      return NextResponse.json(cachedResult, { status: 200 })
    }

    // If not cached, compute and cache it
    let data = await getShippingDataFromRedis(sessionId)
    
    // Apply channel filter if provided (for cascading SKU filter)
    if (channelFilter && channelFilter !== 'All') {
      data = data.filter((record: any) => {
        const channel = record.channel || record.Channel || record.channel__ || null
        return channel && String(channel) === channelFilter
      })
    }
    
    // Apply SKU filter if provided (for cascading product name filter)
    if (skuFilter && skuFilter !== 'All') {
      data = data.filter((record: any) => {
        const skuFields = [
          record['Master SKU'],
          record['master sku'],
          record['MasterSKU'],
          record['masterSKU'],
          record.master__s_k_u,
          record.master_sku,
          record.master_s_k_u,
          record.sku,
          record.SKU,
          record.sku__,
          record.product_sku,
          record['Channel SKU'],
          record['channel sku'],
          record['ChannelSKU'],
          record['channelSKU'],
          record.channel__s_k_u,
          record.channel_sku,
          record.channel_s_k_u,
          record['Product SKU'],
          record['product sku'],
          record['ProductSKU'],
          record.product__s_k_u,
          record.product_s_k_u,
        ]
        return skuFields.some(sku => sku && String(sku).trim() === skuFilter)
      })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No data found',
        },
        { status: 404 }
      )
    }

    // Extract unique values with counts
    const channels = new Set<string>()
    const skuCounts = new Map<string, number>()
    const productNameCounts = new Map<string, number>()
    const statuses = new Set<string>()

    data.forEach((record: any) => {
      // Channel
      const channel = record.channel || record.Channel || record.channel__ || null
      if (channel && channel !== 'none' && channel !== 'N/A' && channel !== '') {
        channels.add(String(channel))
      }

      // SKU - Comprehensive extraction from all possible field name variations
      // Check all possible field names and collect SKUs from all of them
      const skuFields = [
        record['Master SKU'],
        record['master sku'],
        record['MasterSKU'],
        record['masterSKU'],
        record.master__s_k_u,
        record.master_sku,
        record.master_s_k_u,
        record.sku, // Preprocessed field (should contain Master SKU value)
        record.SKU,
        record.sku__,
        record.product_sku,
        record['Channel SKU'],
        record['channel sku'],
        record['ChannelSKU'],
        record['channelSKU'],
        record.channel__s_k_u,
        record.channel_sku,
        record.channel_s_k_u,
        record['Product SKU'],
        record['product sku'],
        record['ProductSKU'],
        record.product__s_k_u,
        record.product_s_k_u,
      ]
      
      // Process all SKU fields and count occurrences
      skuFields.forEach((sku) => {
        if (sku !== null && sku !== undefined) {
          const skuStr = String(sku).trim()
          if (skuStr && 
              skuStr !== 'none' && 
              skuStr !== 'N/A' && 
              skuStr !== 'na' && 
              skuStr !== 'null' && 
              skuStr !== 'undefined' &&
              skuStr !== '') {
            const currentCount = skuCounts.get(skuStr) || 0
            skuCounts.set(skuStr, currentCount + 1)
          }
        }
      })

      // Product Name - Check 'Product Name' field first, then fallback to normalized fields
      // This handles both raw data and preprocessed data
      const productName = record['Product Name'] || 
                         record.product_name || 
                         record.product__name ||
                         record['product name'] ||
                         record.ProductName ||
                         record.productName ||
                         null
      
      if (productName !== null && productName !== undefined) {
        const productNameStr = String(productName).trim()
        if (productNameStr && 
            productNameStr !== 'none' && 
            productNameStr !== 'N/A' && 
            productNameStr !== 'na' && 
            productNameStr !== 'null' && 
            productNameStr !== 'undefined' &&
            productNameStr !== '') {
          const currentCount = productNameCounts.get(productNameStr) || 0
          productNameCounts.set(productNameStr, currentCount + 1)
        }
      }

      // Status - Comprehensive extraction from all possible status field variations
      // Check all possible field names and collect statuses from all of them
      const statusFields = [
        record.delivery_status, // Preprocessed field
        record['Status'], // Original Status field
        record.status,
        record.current_status,
        record['Current Status'],
        record['current status'],
        record.order_status,
        record['Order Status'],
        record['order status'],
        record.shipment_status,
        record['Shipment Status'],
        record['shipment status'],
        record.tracking_status,
        record['Tracking Status'],
        record['tracking status'],
      ]
      
      // Process all status fields and collect unique statuses
      statusFields.forEach((status) => {
        if (status !== null && status !== undefined) {
          const statusStr = String(status).trim()
          if (statusStr && 
              statusStr !== 'none' && 
              statusStr !== 'N/A' && 
              statusStr !== 'na' && 
              statusStr !== 'null' && 
              statusStr !== 'undefined' &&
              statusStr !== '' &&
              statusStr !== "'") {
            // Normalize status values to uppercase
            const statusUpper = statusStr.toUpperCase().trim()
            if (statusUpper) {
              statuses.add(statusUpper)
            }
          }
        }
      })
    })

    // Get top 10 SKUs by frequency
    const skuEntries = Array.from(skuCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 10) // Get top 10
      .map(([sku]) => sku) // Extract just the SKU names
    
    // Get all SKUs for searching (sorted alphabetically)
    const allSkus = Array.from(skuCounts.keys()).sort()

    // Get top 10 Product Names by frequency
    const productNameEntries = Array.from(productNameCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .slice(0, 10) // Get top 10
      .map(([name]) => name) // Extract just the product names
    
    // Get all Product Names for searching (sorted alphabetically)
    const allProductNames = Array.from(productNameCounts.keys()).sort()

    // Use predefined status list instead of extracting from data
    const predefinedStatuses = [
      'CANCELED',
      'DELIVERED',
      'DESTROYED',
      'IN TRANSIT',
      'IN TRANSIT-AT DESTINATION HUB',
      'LOST',
      'OUT FOR DELIVERY',
      'OUT FOR PICKUP',
      'PICKED UP',
      'PICKUP EXCEPTION',
      'REACHED BACK AT_SELLER_CITY',
      'REACHED DESTINATION HUB',
      'RTO DELIVERED',
      'RTO IN TRANSIT',
      'RTO INITIATED',
      'RTO NDR',
      'UNDELIVERED',
      'UNDELIVERED-1st Attempt',
      'UNDELIVERED-2nd Attempt',
      'UNDELIVERED-3rd Attempt',
      'UNTRACEABLE'
    ]
    
    // Normalize and ensure uniqueness
    const uniqueStatuses = predefinedStatuses
      .map(s => s.trim().toUpperCase())
      .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
      .sort() // Sort alphabetically

    // Debug logging - Check sample records for Product Name field (only if DEBUG_ANALYTICS is enabled)
    if (process.env.DEBUG_ANALYTICS === 'true' && data.length > 0) {
      const sampleRecord = data[0]
      console.log('Sample record Product Name fields:', {
        'Product Name': sampleRecord['Product Name'],
        product_name: sampleRecord.product_name,
        product__name: sampleRecord.product__name,
        'product name': sampleRecord['product name'],
        ProductName: sampleRecord.ProductName,
        productName: sampleRecord.productName,
        allKeys: Object.keys(sampleRecord).filter(k => k.toLowerCase().includes('product') || k.toLowerCase().includes('name')),
      })
    }

    // Debug logging (only if DEBUG_ANALYTICS is enabled)
    if (process.env.DEBUG_ANALYTICS === 'true') {
      console.log('Filter options computed:', {
        totalRecords: data.length,
        skuCountsSize: skuCounts.size,
        productNameCountsSize: productNameCounts.size,
        statusesCountBeforeDedup: statuses.size,
        statusesCountAfterDedup: uniqueStatuses.length,
        skusTop10Count: skuEntries.length,
        productNamesTop10Count: productNameEntries.length,
        skusTop10: skuEntries,
        productNamesTop10: productNameEntries,
        firstFewProductNames: Array.from(productNameCounts.keys()).slice(0, 5),
        allStatuses: uniqueStatuses,
      })
    }
    
    // Debug logging - Check sample records for Status fields (only if DEBUG_ANALYTICS is enabled)
    if (process.env.DEBUG_ANALYTICS === 'true' && data.length > 0) {
      const sampleRecord = data[0]
      console.log('Sample record Status fields:', {
        delivery_status: sampleRecord.delivery_status,
        'Status': sampleRecord['Status'],
        status: sampleRecord.status,
        current_status: sampleRecord.current_status,
        allKeys: Object.keys(sampleRecord).filter(k => 
          k.toLowerCase().includes('status') || 
          k.toLowerCase().includes('delivery')
        ),
      })
    }

    const result = {
      success: true,
      channels: Array.from(channels).sort(),
      skus: allSkus, // All SKUs for searching
      skusTop10: skuEntries, // Top 10 SKUs for dropdown
      productNames: allProductNames, // All product names for searching
      productNamesTop10: productNameEntries, // Top 10 product names for dropdown
      statuses: uniqueStatuses, // All unique statuses (deduplicated and normalized)
    }

    // Cache the result
    await saveAnalyticsToRedis(sessionId, cacheKey, result)

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch filter options',
      },
      { status: 500 }
    )
  }
}
