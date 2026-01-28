/**
 * Data Preprocessing Utilities for Shipping Analytics
 * 
 * Functions to normalize and clean shipping_details collection data
 */

export interface ShippingDetail {
  [key: string]: any
}

/**
 * Normalize keys to snake_case
 */
export function normalizeKeys(obj: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    
    normalized[snakeKey] = value
  }
  
  return normalized
}

/**
 * Standardize missing values (none, N/A, empty → null)
 */
export function standardizeMissingValues(value: any): any {
  if (value === null || value === undefined) return null
  
  const str = String(value).trim().toLowerCase()
  
  if (str === '' || str === 'none' || str === 'n/a' || str === 'na' || str === 'null') {
    return null
  }
  
  return value
}

/**
 * Convert date string to ISODate
 * Handles multiple formats: MM/DD/YY, MM/DD/YYYY, ISO strings, etc.
 */
export function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null
  
  const standardized = standardizeMissingValues(dateStr)
  if (!standardized) return null
  
  const dateString = String(standardized).trim()
  
  // Handle "N/A" and similar
  if (dateString.toUpperCase() === 'N/A' || dateString === "'") {
    return null
  }
  
  try {
    // Try parsing MM/DD/YY or MM/DD/YYYY format (e.g., "12/10/25" or "12/10/2025")
    const mmddyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
    const match = dateString.match(mmddyyPattern)
    
    if (match) {
      const month = parseInt(match[1], 10) - 1 // JS months are 0-indexed
      const day = parseInt(match[2], 10)
      let year = parseInt(match[3], 10)
      
      // Handle 2-digit years: assume 20XX if < 50, 19XX otherwise
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year
      }
      
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
    
    // Try standard Date parsing
    const date = new Date(dateString)
    if (!isNaN(date.getTime())) {
      return date
    }
  } catch {
    // If all parsing fails, return null
  }
  
  return null
}

/**
 * Convert to number
 */
export function parseNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  
  const standardized = standardizeMissingValues(value)
  if (!standardized) return null
  
  if (typeof standardized === 'number') {
    return isNaN(standardized) ? null : standardized
  }
  
  const num = parseFloat(String(standardized).replace(/[^0-9.-]/g, ''))
  return isNaN(num) ? null : num
}

/**
 * Convert to boolean
 */
export function parseBoolean(value: any): boolean {
  if (value === null || value === undefined) return false
  
  const str = String(value).trim().toLowerCase()
  return str === 'true' || str === 'yes' || str === '1' || str === 'y'
}

/**
 * Get order week from date (based on monthly date ranges: 1-7, 8-14, 15-21, 22-28, 29-31)
 * Returns format: "YYYY-MM-DD-DD" (e.g., "2025-12-01-07" for Dec 1-7)
 */
export function getOrderWeek(date: Date | null): string | null {
  if (!date) return null
  
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // JS months are 0-indexed
  const day = d.getDate()
  
  // Calculate which week of the month based on day ranges
  let weekStart: number
  let weekEnd: number
  
  if (day >= 1 && day <= 7) {
    weekStart = 1
    weekEnd = 7
  } else if (day >= 8 && day <= 14) {
    weekStart = 8
    weekEnd = 14
  } else if (day >= 15 && day <= 21) {
    weekStart = 15
    weekEnd = 21
  } else if (day >= 22 && day <= 28) {
    weekStart = 22
    weekEnd = 28
  } else {
    // Days 29-31 (remaining days)
    weekStart = 29
    // Get last day of the month
    const lastDayOfMonth = new Date(year, month, 0).getDate()
    weekEnd = lastDayOfMonth
  }
  
  // Format as "YYYY-MM-DD-DD" (e.g., "2025-12-01-07")
  const monthStr = String(month).padStart(2, '0')
  const startStr = String(weekStart).padStart(2, '0')
  const endStr = String(weekEnd).padStart(2, '0')
  
  return `${year}-${monthStr}-${startStr}-${endStr}`
}

/**
 * Determine delivery status
 */
export function getDeliveryStatus(doc: Record<string, any>, originalDoc?: Record<string, any>): string {
  // Helper function to normalize strings for comparison
  const normalizeForComparison = (str: string) => str.replace(/[\s\-_]/g, '').toUpperCase()
  
  // Check original Status field FIRST (before normalization) - preserve explicit status values
  // originalDoc is passed to preserve the original field name before normalizeKeys
  const statusField = originalDoc?.['Status'] || 
                     doc['Status'] || 
                     doc.status || 
                     doc.original_status ||
                     doc.delivery_status || 
                     doc.current_status
  const statusStr = String(statusField || '').toUpperCase().trim()
  
  // If Status field has an explicit status value, return it immediately (don't override with dates)
  // List of statuses that should be preserved from the Status field
  const explicitStatuses = [
    'CANCELED', 'CANCELLED', 'CANCEL',
    'DESTROYED',
    'LOST',
    'UNTRACEABLE',
    'PICKUP EXCEPTION',
    'REACHED BACK AT_SELLER_CITY',
    'REACHED DESTINATION HUB',
    'RTO DELIVERED',
    'RTO IN TRANSIT',
    'RTO INITIATED',
    'RTO NDR',
    'UNDELIVERED-1ST ATTEMPT',
    'UNDELIVERED-2ND ATTEMPT',
    'UNDELIVERED-3RD ATTEMPT',
    'UNDELIVERED-1ST-ATTEMPT',
    'UNDELIVERED-2ND-ATTEMPT',
    'UNDELIVERED-3RD-ATTEMPT',
    'OUT FOR DELIVERY',
    'OUT FOR PICKUP',
    'PICKED UP',
    'IN TRANSIT',
    'IN TRANSIT-AT DESTINATION HUB'
  ]
  
  // Check if the status field contains any explicit status - return it immediately
  for (const explicitStatus of explicitStatuses) {
    const normalizedStatusStr = normalizeForComparison(statusStr)
    const normalizedExplicitStatus = normalizeForComparison(explicitStatus)
    
    // Check exact match or contains match
    if (statusStr === explicitStatus || 
        statusStr.toUpperCase() === explicitStatus.toUpperCase() ||
        normalizedStatusStr === normalizedExplicitStatus ||
        normalizedStatusStr.includes(normalizedExplicitStatus) ||
        normalizedExplicitStatus.includes(normalizedStatusStr)) {
      // Return the exact status from the Status field (preserve original casing/spacing)
      // But normalize to standard format for consistency
      if (normalizedStatusStr.includes('RTODELIVERED')) return 'RTO DELIVERED'
      if (normalizedStatusStr.includes('RTOINITIATED')) return 'RTO INITIATED'
      if (normalizedStatusStr.includes('RTOINTRANSIT')) return 'RTO IN TRANSIT'
      if (normalizedStatusStr.includes('RTONDR')) return 'RTO NDR'
      return statusStr
    }
  }
  
  // If Status field has a value but it's not in the explicit list, still preserve it
  if (statusStr && statusStr !== 'N/A' && statusStr !== 'NONE' && statusStr !== 'NULL' && statusStr !== '') {
    // Check if it's a known status format
    const knownStatusPatterns = [
      /^DELIVERED$/i,
      /^UNDELIVERED/i,
      /^RTO/i,
      /^NDR/i,
      /^PENDING/i,
      /^CANCEL/i
    ]
    
    // If it matches a known pattern but wasn't in explicit list, return as-is
    const matchesKnownPattern = knownStatusPatterns.some(pattern => pattern.test(statusStr))
    if (!matchesKnownPattern) {
      // Unknown status - return as-is to preserve it
      return statusStr
    }
  }
  
  // Check if delivered date exists
  if (doc['Order Delivered Date'] || doc.order__delivered__date || doc.delivery_date || doc.delivered_date) {
    const deliveredDate = doc['Order Delivered Date'] || doc.order__delivered__date || doc.delivery_date || doc.delivered_date
    if (deliveredDate && deliveredDate !== 'N/A' && deliveredDate !== "'" && deliveredDate !== 'none') {
      return 'DELIVERED'
    }
  }
  
  // Check NDR fields
  if (doc['Latest NDR Date'] || doc.latest__n_d_r__date || doc.ndr_date) {
    const ndrDate = doc['Latest NDR Date'] || doc.latest__n_d_r__date || doc.ndr_date
    if (ndrDate && ndrDate !== 'N/A' && ndrDate !== "'" && ndrDate !== 'none') {
      return 'NDR'
    }
  }
  
  // Check RTO fields - but only if Status doesn't already specify an RTO status
  // Normalize statusStr for comparison
  const normalizedStatusForRto = normalizeForComparison(statusStr)
  const hasRtoStatus = normalizedStatusForRto.includes('RTODELIVERED') || 
                       normalizedStatusForRto.includes('RTOINITIATED') || 
                       normalizedStatusForRto.includes('RTOINTRANSIT') || 
                       normalizedStatusForRto.includes('RTONDR')
  
  if (!hasRtoStatus) {
    if (doc['RTO Initiated Date'] || doc.r_t_o__initiated__date || doc.rto_date) {
      const rtoDate = doc['RTO Initiated Date'] || doc.r_t_o__initiated__date || doc.rto_date
      if (rtoDate && rtoDate !== 'N/A' && rtoDate !== "'" && rtoDate !== 'none') {
        // Check if there's an RTO Delivered Date - if so, it's RTO DELIVERED
        const rtoDeliveredDate = doc['RTO Delivered Date'] || doc.r_t_o__delivered__date || doc.rto_delivered_date
        if (rtoDeliveredDate && rtoDeliveredDate !== 'N/A' && rtoDeliveredDate !== "'" && rtoDeliveredDate !== 'none') {
          return 'RTO DELIVERED'
        }
        return 'RTO INITIATED'
      }
    }
  }
  
  // Check OFD (Out For Delivery)
  if (doc['First Out For Delivery Date'] || doc.first__out__for__delivery__date || doc['Latest OFD Date'] || doc.latest__o_f_d__date) {
    const ofdDate = doc['First Out For Delivery Date'] || doc.first__out__for__delivery__date || doc['Latest OFD Date'] || doc.latest__o_f_d__date
    if (ofdDate && ofdDate !== 'N/A' && ofdDate !== "'" && ofdDate !== 'none') {
      return 'OFD'
    }
  }
  
  // Check for other explicit statuses in the Status field
  if (statusStr && statusStr !== 'N/A' && statusStr !== 'NONE' && statusStr !== 'NULL' && statusStr !== '') {
    // Return the status as-is if it's a valid status
    return statusStr
  }
  
  return 'PENDING'
}

/**
 * Determine address quality
 */
export function getAddressQuality(doc: Record<string, any>): string {
  // Check actual address fields from your data structure
  const addressLine1 = doc['Address Line 1'] || doc.address__line_1 || doc.address_line_1 || ''
  const addressLine2 = doc['Address Line 2'] || doc.address__line_2 || doc.address_line_2 || ''
  const city = doc['Address City'] || doc.address__city || doc.city || ''
  const state = doc['Address State'] || doc.address__state || doc.state || ''
  const pincode = doc['Address Pincode'] || doc.address__pincode || doc.pincode || ''
  
  const fullAddress = `${addressLine1} ${addressLine2} ${city} ${state} ${pincode}`.trim()
  
  if (!addressLine1 || addressLine1 === 'none' || addressLine1 === 'N/A' || fullAddress.length < 10) {
    return 'INVALID'
  }
  
  // Check if address seems incomplete (missing city, state, or pincode)
  if (!city || !state || !pincode || city === 'none' || state === 'none' || pincode === 'none') {
    return 'SHORT'
  }
  
  if (fullAddress.length < 30) {
    return 'SHORT'
  }
  
  return 'GOOD'
}

/**
 * Calculate TAT in hours between two dates
 */
export function calculateTAT(startDate: Date | null, endDate: Date | null): number | null {
  if (!startDate || !endDate) return null
  
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  
  return diffHours >= 0 ? diffHours : null
}

/**
 * Main preprocessing function
 */
export function preprocessShippingDetail(rawDoc: Record<string, any>): Record<string, any> {
  // Save original doc for field lookup before normalization
  const originalDoc = { ...rawDoc }
  
  // Normalize keys
  let doc = normalizeKeys(rawDoc)
  
  // Standardize missing values
  for (const key in doc) {
    doc[key] = standardizeMissingValues(doc[key])
  }
  
  // Parse dates - map actual field names from your data structure
  // Check both original field names and normalized names
  const dateFieldMapping: Record<string, string[]> = {
    'order_date': ['Shiprocket Created At', 'shiprocket created at', 'shiprocket__created__at', 'shiprocket_created_at', 'order_date', 'order_placed_date', 'created_at', 'Channel Created At', 'channel__created__at', 'channel created at'],
    'pickup_date': ['Order Picked Up Date', 'order__picked__up__date', 'Pickedup Timestamp', 'pickedup__timestamp', 'pickup_date', 'pickup_datetime'],
    'ofd_date': ['First Out For Delivery Date', 'first__out__for__delivery__date', 'Latest OFD Date', 'latest__o_f_d__date', 'ofd_date', 'ofd_datetime', 'out_for_delivery_date'],
    'delivery_date': ['Order Delivered Date', 'order__delivered__date', 'delivery_date', 'delivered_date', 'delivered_datetime'],
    'ndr_date': ['Latest NDR Date', 'latest__n_d_r__date', 'NDR 1 Attempt Date', 'n_d_r_1__attempt__date', 'ndr_date', 'ndr_datetime'],
    'rto_date': ['RTO Initiated Date', 'r_t_o__initiated__date', 'RTO Delivered Date', 'r_t_o__delivered__date', 'rto_date', 'rto_datetime'],
    'cancellation_date': ['cancellation_date', 'canceled_date'],
  }
  
  const parsedDates: Record<string, Date | null> = {}
  Object.entries(dateFieldMapping).forEach(([key, fields]) => {
    for (const field of fields) {
      // Check both original doc and normalized doc
      const value = originalDoc[field] || doc[field]
      if (value && value !== 'N/A' && value !== "'" && value !== 'none' && value !== null) {
        const parsed = parseDate(value)
        if (parsed) {
          parsedDates[key] = parsed
          // Store as ISO date string (YYYY-MM-DD) using LOCAL date, not UTC
          // This prevents timezone issues (e.g., IST loses a day with toISOString)
          const year = parsed.getFullYear()
          const month = String(parsed.getMonth() + 1).padStart(2, '0')
          const day = String(parsed.getDate()).padStart(2, '0')
          doc[key] = `${year}-${month}-${day}`
          break // Use first valid date found
        }
      }
    }
  })
  
  // Parse numbers - map actual field names
  const numberFieldMapping: Record<string, string[]> = {
    'order_value': ['Order Total', 'order total', 'order__total', 'order_total', 'order_value', 'price', 'amount'],
    'order_price': ['Product Price', 'product price', 'product__price', 'product_price'],
    'weight': ['Weight (KG)', 'weight (kg)', 'weight__k_g', 'weight_k_g', 'weight', 'weight_kg'],
    'order_risk_score': ['Order Risk', 'order risk', 'order__risk', 'order_risk', 'Address Score', 'address score', 'address__score', 'address_score'],
  }
  
  Object.entries(numberFieldMapping).forEach(([key, fields]) => {
    for (const field of fields) {
      // Check both original doc and normalized doc
      const value = originalDoc[field] || doc[field]
      if (value !== undefined && value !== 'none' && value !== 'N/A' && value !== null) {
        const parsed = parseNumber(value)
        if (parsed !== null) {
          doc[key] = parsed
          break
        }
      }
    }
  })
  
  // Also set order_value from order__total if not already set
  if (!doc.order_value && doc.order__total) {
    doc.order_value = parseNumber(doc.order__total)
  }
  
  // Parse booleans
  const booleanFields = [
    'ndr', 'rto', 'cancelled', 'canceled',
    'address_verified', 'is_verified',
  ]
  
  booleanFields.forEach(field => {
    if (doc[field] !== undefined) {
      doc[field] = parseBoolean(doc[field])
    }
  })
  
  // Map category field - check both original and normalized
  doc.category = originalDoc['Product Category'] || originalDoc['product category'] || doc['Product Category'] || doc.product__category || doc.product_category || doc.category || null
  if (doc.category === 'none' || doc.category === 'N/A' || doc.category === null || doc.category === '') {
    doc.category = 'Uncategorized'
  }
  
  // Map channel field - check both original and normalized
  doc.channel = originalDoc['Channel'] || originalDoc['channel'] || doc['Channel'] || doc.channel || doc.channel__ || null
  if (doc.channel === 'none' || doc.channel === 'N/A' || doc.channel === null || doc.channel === '') {
    doc.channel = null
  }
  
  // Map state field for consistency
  doc.state = originalDoc['Address State'] || originalDoc['address state'] || doc['Address State'] || doc.address__state || doc.address_state || doc.state || null
  
  // Map SKU, Product Name and Payment Method for consistency
  doc.sku = originalDoc['Master SKU'] || originalDoc['Channel SKU'] || doc.master__s_k_u || doc.channel__s_k_u || doc.sku || null
  doc.product_name = originalDoc['Product Name'] || doc.product__name || doc.product_name || null
  doc.payment_method = originalDoc['Payment Method'] || doc.payment__method || doc.payment_method || null
  
  // Preserve original Status field before preprocessing (important for filtering)
  // Keep both normalized and original Status field
  doc.original_status = originalDoc['Status'] || originalDoc['status'] || doc.status || null
  if (doc.original_status) {
    doc.status = doc.original_status // Keep original Status value
  }

  // Derived fields
  const orderDate = parsedDates.order_date || parsedDates.order_placed_date || parsedDates.created_at
  doc.order_week = getOrderWeek(orderDate)
  
  // Set flags based on actual data fields - check both original and normalized
  const status = originalDoc['Status'] || originalDoc['status'] || doc['Status'] || doc.status || ''
  const statusUpper = String(status).toUpperCase()
  
  const latestNdrDate = originalDoc['Latest NDR Date'] || originalDoc['latest ndr date'] || doc['Latest NDR Date'] || doc.latest__n_d_r__date || doc.latest_n_d_r_date
  const latestNdrReason = originalDoc['Latest NDR Reason'] || originalDoc['latest ndr reason'] || doc['Latest NDR Reason'] || doc.latest__n_d_r__reason
  
  doc.ndr_flag = Boolean(
    (latestNdrDate && latestNdrDate !== 'N/A' && latestNdrDate !== "'" && latestNdrDate !== 'none') ||
    (latestNdrReason && latestNdrReason !== 'N/A' && latestNdrReason !== 'none') ||
    doc.delivery_status === 'NDR'
  )
  
  const rtoInitiatedDate = originalDoc['RTO Initiated Date'] || originalDoc['rto initiated date'] || doc['RTO Initiated Date'] || doc.r_t_o__initiated__date || doc.rto_initiated_date
  
  doc.rto_flag = Boolean(
    (rtoInitiatedDate && rtoInitiatedDate !== 'N/A' && rtoInitiatedDate !== "'" && rtoInitiatedDate !== 'none') ||
    doc.delivery_status === 'RTO'
  )
  
  const cancellationReason = originalDoc['Cancellation Reason'] || originalDoc['cancellation reason'] || doc['Cancellation Reason'] || doc.cancellation__reason || doc.cancellation_reason
  
  doc.cancelled_flag = Boolean(
    statusUpper.includes('CANCEL') ||
    (cancellationReason && cancellationReason !== 'none' && cancellationReason !== 'N/A' && cancellationReason !== null)
  )
  
  // Pass originalDoc to getDeliveryStatus to preserve original Status field
  doc.delivery_status = getDeliveryStatus(doc, originalDoc)
  doc.address_quality = getAddressQuality(doc)
  
  // Calculate TAT metrics
  const pickupDate = parsedDates.pickup_date || parsedDates.pickup_datetime
  const ofdDate = parsedDates.ofd_date || parsedDates.ofd_datetime || parsedDates.out_for_delivery_date
  const deliveryDate = parsedDates.delivery_date || parsedDates.delivered_date || parsedDates.delivered_datetime
  
  doc.order_to_pickup_tat = calculateTAT(orderDate, pickupDate)
  doc.pickup_to_ofd_tat = calculateTAT(pickupDate, ofdDate)
  doc.ofd_to_delivery_tat = calculateTAT(ofdDate, deliveryDate)
  
  if (orderDate && deliveryDate) {
    doc.total_tat = calculateTAT(orderDate, deliveryDate)
  }
  
  // Order risk score
  doc.order_risk_score = parseNumber(doc.order_risk_score) || parseNumber(doc.risk_score) || 0
  
  // Add processed timestamp
  doc.processed_at = new Date()
  
  return doc
}
