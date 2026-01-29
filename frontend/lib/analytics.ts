/**
 * Analytics Computation Functions
 * 
 * Functions to compute analytics from shipping data stored in Redis
 */

import { getShippingDataFromRedis, saveAnalyticsToRedis, buildAnalyticsKey } from './redis'
import { getOrderWeek, parseDate } from './dataPreprocessing'

export interface ShippingRecord {
  [key: string]: any
}

export interface FilterParams {
  startDate?: string | null
  endDate?: string | null
  orderStatus?: string
  paymentMethod?: string
  channel?: string
  sku?: string | string[]
  productName?: string | string[]
}

/**
 * Filter shipping data based on filter parameters
 */
export function filterShippingData(data: ShippingRecord[], filters: FilterParams): ShippingRecord[] {
  let filtered = [...data]

  // Date range filter (comparing ISO date strings: YYYY-MM-DD)
  if (filters.startDate || filters.endDate) {
    filtered = filtered.filter((record) => {
      // Try to find a date field in order of priority
      // Check all possible field names for the order date
      let orderDateValue: any = null
      
      // Priority 1: Preprocessed ISO format field
      if (record.order_date) {
        orderDateValue = record.order_date
      }
      // Priority 2: Other normalized field names
      else if (record.order__date) {
        orderDateValue = record.order__date
      }
      // Priority 3: Original field names
      else if (record['Order Date']) {
        orderDateValue = record['Order Date']
      } else if (record['Shiprocket Created At']) {
        orderDateValue = record['Shiprocket Created At']
      }
      // Priority 4: Normalized versions of raw field names
      else if (record.shiprocket__created__at) {
        orderDateValue = record.shiprocket__created__at
      } else if (record.shiprocket_created_at) {
        orderDateValue = record.shiprocket_created_at
      } else if (record.channel__created__at) {
        orderDateValue = record.channel__created__at
      } else if (record.created_at) {
        orderDateValue = record.created_at
      }
      
      // If still no date found, skip this record
      if (!orderDateValue) return false

      // Handle both string dates (YYYY-MM-DD from preprocessing) and Date objects
      let orderDateStr: string
      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in ISO date format (YYYY-MM-DD)
        orderDateStr = orderDateValue
      } else if (typeof orderDateValue === 'string') {
        // Try to parse and convert to ISO format
        // Handle MM/DD/YY format (like "12/10/25") and other formats
        try {
          const parsed = parseDate(orderDateValue)
          if (!parsed) {
            return false
          }
          orderDateStr = parsed.toISOString().split('T')[0]
        } catch (e) {
          return false
        }
      } else if (orderDateValue instanceof Date) {
        orderDateStr = orderDateValue.toISOString().split('T')[0]
      } else {
        return false
      }

      // String comparison works for ISO dates (YYYY-MM-DD format)
      if (filters.startDate && orderDateStr < filters.startDate) {
        return false
      }

      if (filters.endDate && orderDateStr > filters.endDate) {
        return false
      }

      return true
    })
  }

  // Order status filter
  if (filters.orderStatus && filters.orderStatus !== 'All') {
    filtered = filtered.filter((record) => {
      const filterStatus = filters.orderStatus!.toUpperCase().trim()
      
      // For explicit statuses, ONLY check the original Status field, NOT delivery_status
      // This ensures that statuses like "RTO DELIVERED", "DESTROYED", "LOST" etc. 
      // are matched based on the original Status field, not the computed delivery_status
      const explicitStatuses = [
        'CANCELED', 'CANCELLED', 'DESTROYED', 'LOST', 'UNTRACEABLE',
        'RTO DELIVERED', 'RTO IN TRANSIT', 'RTO INITIATED', 'RTO NDR',
        'REACHED BACK AT_SELLER_CITY', 'REACHED DESTINATION HUB',
        'PICKUP EXCEPTION', 'OUT FOR DELIVERY', 'OUT FOR PICKUP', 'PICKED UP',
        'IN TRANSIT', 'IN TRANSIT-AT DESTINATION HUB',
        'UNDELIVERED-1ST ATTEMPT', 'UNDELIVERED-2ND ATTEMPT', 'UNDELIVERED-3RD ATTEMPT'
      ]
      
      const isExplicitStatus = explicitStatuses.some(explicit => 
        filterStatus === explicit || 
        filterStatus.replace(/[_\s-]/g, ' ') === explicit.replace(/[_\s-]/g, ' ')
      )
      
      // Get status value - prioritize original Status fields for explicit statuses
      let statusValue: any = ''
      if (isExplicitStatus) {
        // For explicit statuses, ONLY check original Status fields
        statusValue = record.original_status ||  // Preserved original Status field
                     record['Status'] ||         // Original field name (before normalization)
                     record.status ||            // Normalized field name (after normalizeKeys)
                     ''
      } else {
        // For other statuses (like DELIVERED, UNDELIVERED), check all fields
        statusValue = record.original_status ||  // Preserved original Status field
                     record['Status'] ||         // Original field name (before normalization)
                     record.status ||            // Normalized field name (after normalizeKeys)
                     record.delivery_status ||   // Preprocessed field
                     record.current_status ||
                     ''
      }
      
      const status = String(statusValue).toUpperCase().trim()

      // Handle empty/null statuses - these should NOT match specific status filters
      if (!status || status === '' || status === 'NULL' || status === 'UNDEFINED' || status === 'NONE' || status === 'N/A') {
        return false
      }

      // Handle status mappings and variations
      // Map common variations to the new status format
      const statusMappings: Record<string, string[]> = {
        'CANCELED': ['CANCELED', 'CANCELLED', 'CANCEL', 'CANCELLATION'],
        'DELIVERED': ['DELIVERED', 'DEL'],
        'DESTROYED': ['DESTROYED', 'DESTROY'], // Include variations
        'IN TRANSIT': ['IN TRANSIT', 'IN_TRANSIT', 'IN-TRANSIT', 'INTRANSIT'],
        'IN TRANSIT-AT DESTINATION HUB': ['IN TRANSIT-AT DESTINATION HUB', 'IN TRANSIT AT DESTINATION HUB', 'IN_TRANSIT_AT_DESTINATION_HUB'],
        'LOST': ['LOST'],
        'OUT FOR DELIVERY': ['OUT FOR DELIVERY', 'OFD', 'OUT_FOR_DELIVERY', 'OUTFORDELIVERY'],
        'OUT FOR PICKUP': ['OUT FOR PICKUP', 'OUT_FOR_PICKUP', 'OUTFORPICKUP'],
        'PICKED UP': ['PICKED UP', 'PICKED_UP', 'PICKUP', 'PICKEDUP'],
        'PICKUP EXCEPTION': ['PICKUP EXCEPTION', 'PICKUP_EXCEPTION', 'PICKUPEXCEPTION'],
        'REACHED BACK AT_SELLER_CITY': ['REACHED BACK AT_SELLER_CITY', 'REACHED BACK AT SELLER CITY', 'REACHED_BACK_AT_SELLER_CITY'],
        'REACHED DESTINATION HUB': ['REACHED DESTINATION HUB', 'REACHED_DESTINATION_HUB', 'REACHEDDESTINATIONHUB'],
        'RTO DELIVERED': ['RTO DELIVERED', 'RTO_DELIVERED', 'RTODELIVERED'],
        'RTO IN TRANSIT': ['RTO IN TRANSIT', 'RTO_IN_TRANSIT', 'RTOINTRANSIT'],
        'RTO INITIATED': ['RTO INITIATED', 'RTO_INITIATED', 'RTO', 'RTOINITIATED'],
        'RTO NDR': ['RTO NDR', 'RTO_NDR', 'RTONDR'],
        'UNDELIVERED': ['UNDELIVERED', 'NDR', 'PENDING', 'UNDELIVERED-1ST ATTEMPT', 'UNDELIVERED-2ND ATTEMPT', 'UNDELIVERED-3RD ATTEMPT'],
        'UNDELIVERED-1ST ATTEMPT': ['UNDELIVERED-1ST ATTEMPT', 'UNDELIVERED-1st Attempt', 'UNDELIVERED_1ST_ATTEMPT', 'UNDELIVERED-1ST-ATTEMPT'],
        'UNDELIVERED-2ND ATTEMPT': ['UNDELIVERED-2ND ATTEMPT', 'UNDELIVERED-2nd Attempt', 'UNDELIVERED_2ND_ATTEMPT', 'UNDELIVERED-2ND-ATTEMPT'],
        'UNDELIVERED-3RD ATTEMPT': ['UNDELIVERED-3RD ATTEMPT', 'UNDELIVERED-3rd Attempt', 'UNDELIVERED_3RD_ATTEMPT', 'UNDELIVERED-3RD-ATTEMPT'],
        'UNTRACEABLE': ['UNTRACEABLE']
      }

      // Check if the filter status has mappings
      if (statusMappings[filterStatus]) {
        const isMatch = statusMappings[filterStatus].includes(status)
        return isMatch
      }

      // Exact match (case-insensitive, handle variations with spaces/dashes/underscores)
      const normalizedStatus = status.replace(/[_\s-]/g, ' ')
      const normalizedFilterStatus = filterStatus.replace(/[_\s-]/g, ' ')
      const exactMatch = normalizedStatus === normalizedFilterStatus || status === filterStatus
      
      return exactMatch
    })
  }

  // Payment method filter
  if (filters.paymentMethod && filters.paymentMethod !== 'All') {
    filtered = filtered.filter((record) => {
      const paymentMethod = record.payment_method || 
                           record['Payment Method'] || 
                           record.payment__method || 
                           record.paymentmethod || 
                           ''
      const paymentUpper = String(paymentMethod).toUpperCase()

      if (filters.paymentMethod === 'NaN') {
        return !paymentMethod || paymentMethod === 'none' || paymentMethod === 'N/A' || paymentMethod === ''
      }
      if (filters.paymentMethod === 'COD') {
        return paymentUpper.includes('COD') || paymentUpper.includes('CASH') || paymentUpper === 'COD'
      }
      if (filters.paymentMethod === 'Online') {
        return paymentUpper.includes('ONLINE') || 
               paymentUpper.includes('PREPAID') || 
               paymentUpper.includes('PAID') ||
               paymentUpper === 'ONLINE'
      }

      return true
    })
  }

  // Channel filter
  if (filters.channel && filters.channel !== 'All') {
    filtered = filtered.filter((record) => {
      const channel = record.channel || record.Channel || record.channel__ || ''
      return String(channel) === filters.channel
    })
  }

  // SKU filter - Support multiple SKUs (array) or single SKU (string)
  if (filters.sku && filters.sku !== 'All') {
    const skuArray = Array.isArray(filters.sku) ? filters.sku : [filters.sku]
    if (skuArray.length > 0) {
      filtered = filtered.filter((record) => {
        const sku = record['Master SKU'] || 
                    record['master sku'] || 
                    record.master__s_k_u || 
                    record.master_sku ||
                    record.sku || 
                    record.SKU || 
                    record.sku__ || 
                    record.product_sku || 
                    record['Channel SKU'] ||
                    record['channel sku'] ||
                    record.channel__s_k_u ||
                    record.channel_sku ||
                    ''
        return skuArray.includes(String(sku))
      })
    }
  }

  // Product name filter - Support multiple product names (array) or single product name (string)
  if (filters.productName && filters.productName !== 'All') {
    const productNameArray = Array.isArray(filters.productName) ? filters.productName : [filters.productName]
    if (productNameArray.length > 0) {
      filtered = filtered.filter((record) => {
        const productName = record['Product Name'] || 
                           record.product_name || 
                           record.product__name ||
                           ''
        return productNameArray.includes(String(productName))
      })
    }
  }

  return filtered
}

/**
 * Compute weekly summary analytics
 */
export function computeWeeklySummary(data: ShippingRecord[]): any[] {
  const weeklyMap = new Map<string, any>()

  data.forEach((record) => {
    const week = record.order_week || 'Unknown'
    
    if (!weeklyMap.has(week)) {
      weeklyMap.set(week, {
        order_week: week,
        total_orders: 0,
        total_order_value: 0,
        avg_order_value: 0,
        total_ndr: 0,
        ndr_delivered_after: 0,
        ndr_rate_percent: 0,
        ndr_conversion_percent: 0,
        fad_count: 0,
        ofd_count: 0,
        del_count: 0,
        ndr_count: 0,
        rto_count: 0,
        avg_total_tat: 0,
        tat_sum: 0,
        tat_count: 0,
      })
    }

    const weekData = weeklyMap.get(week)!
    weekData.total_orders++

    // Count statuses - use original Status field first for accuracy
    const status = String(
      record.original_status ||  // Preserved original Status field
      record['Status'] ||        // Original field name (before normalization)
      record.status ||           // Normalized field name (after normalizeKeys)
      record.delivery_status ||  // Preprocessed field (fallback)
      ''
    ).toUpperCase().trim()
    
    // GMV - Only count for DELIVERED orders
    if (status === 'DELIVERED') {
      weekData.del_count++
      // Check if delivered after NDR
      if (record.ndr_flag) {
        weekData.ndr_delivered_after++
      }
      // Add order value to GMV only for delivered orders
      const orderValue = parseFloat(record.order_value) || 
                       parseFloat(record.gmv_amount) ||
                       parseFloat(record['Order Total']) ||
                       parseFloat(record.order__total) ||
                       parseFloat(record.total_order_value) ||
                       0
      weekData.total_order_value += orderValue
    } else if (status === 'OFD' || status === 'OUT FOR DELIVERY') {
      weekData.ofd_count++
    } else if (status === 'NDR') {
      weekData.ndr_count++
      weekData.total_ndr++
    } else if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
      weekData.rto_count++
    }

    // FAD (First Attempt Delivery) - delivered without NDR
    if (status === 'DELIVERED' && !record.ndr_flag) {
      weekData.fad_count++
    }

    // TAT calculation
    if (record.total_tat !== null && record.total_tat !== undefined) {
      weekData.tat_sum += record.total_tat
      weekData.tat_count++
    }
  })

  // Calculate averages and percentages
  const result: any[] = []
  weeklyMap.forEach((weekData) => {
    // Average order value based on delivered orders only (since GMV is delivered-only)
    weekData.avg_order_value = weekData.del_count > 0 
      ? weekData.total_order_value / weekData.del_count 
      : 0
    
    weekData.ndr_rate_percent = weekData.total_orders > 0
      ? (weekData.total_ndr / weekData.total_orders) * 100
      : 0
    
    weekData.ndr_conversion_percent = weekData.total_ndr > 0
      ? (weekData.ndr_delivered_after / weekData.total_ndr) * 100
      : 0
    
    weekData.avg_total_tat = weekData.tat_count > 0
      ? weekData.tat_sum / weekData.tat_count
      : 0

    delete weekData.tat_sum
    delete weekData.tat_count

    result.push(weekData)
  })

  return result.sort((a, b) => a.order_week.localeCompare(b.order_week))
}

/**
 * Compute NDR weekly analytics
 */
export function computeNDRWeekly(data: ShippingRecord[]): any[] {
  const weeklyMap = new Map<string, any>()

  data.forEach((record) => {
    if (!record.ndr_flag) return

    const week = record.order_week || 'Unknown'
    
    if (!weeklyMap.has(week)) {
      weeklyMap.set(week, {
        order_week: week,
        total_ndr: 0,
        ndr_delivered_after: 0,
        ndr_rate_percent: 0,
        ndr_conversion_percent: 0,
        ndr_reasons: new Map<string, number>(),
      })
    }

    const weekData = weeklyMap.get(week)!
    weekData.total_ndr++

    // Check if delivered after NDR
    if (record.delivery_status === 'DELIVERED') {
      weekData.ndr_delivered_after++
    }

    // Track NDR reasons
    const ndrReason = record.latest__n_d_r__reason || record.latest_ndr_reason || record.ndr_reason || 'Unknown'
    const currentCount = weekData.ndr_reasons.get(ndrReason) || 0
    weekData.ndr_reasons.set(ndrReason, currentCount + 1)
  })

  // Calculate percentages and format
  const result: any[] = []
  const totalOrders = data.length

  weeklyMap.forEach((weekData) => {
    const weekOrders = data.filter(r => r.order_week === weekData.order_week).length
    
    weekData.ndr_rate_percent = weekOrders > 0
      ? (weekData.total_ndr / weekOrders) * 100
      : 0
    
    weekData.ndr_conversion_percent = weekData.total_ndr > 0
      ? (weekData.ndr_delivered_after / weekData.total_ndr) * 100
      : 0

    // Convert reasons map to object
    const reasons: Record<string, number> = {}
    weekData.ndr_reasons.forEach((count, reason) => {
      reasons[reason] = count
    })
    weekData.ndr_reasons = reasons

    delete weekData.ndr_reasons // Remove the map, keep the object if needed

    result.push(weekData)
  })

  return result.sort((a, b) => a.order_week.localeCompare(b.order_week))
}

/**
 * Compute state performance analytics
 */
export function computeStatePerformance(data: ShippingRecord[]): any[] {
  const stateMap = new Map<string, any>()

  data.forEach((record) => {
    const state = record.state || record.address__state || 'Unknown'
    
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        state,
        total_orders: 0,
        del_count: 0,
        rto_count: 0,
        ndr_count: 0,
        delivered_percent: 0,
        rto_percent: 0,
        ndr_percent: 0,
      })
    }

    const stateData = stateMap.get(state)!
    stateData.total_orders++

    // Use original Status field first for accuracy
    const status = String(
      record.original_status ||  // Preserved original Status field
      record['Status'] ||        // Original field name (before normalization)
      record.status ||           // Normalized field name (after normalizeKeys)
      record.delivery_status ||  // Preprocessed field (fallback)
      ''
    ).toUpperCase().trim()
    
    if (status === 'DELIVERED') {
      stateData.del_count++
    } else if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
      stateData.rto_count++
    } else if (status === 'NDR') {
      stateData.ndr_count++
    }
  })

  // Calculate total orders for order share percentage
  const totalOrders = Array.from(stateMap.values()).reduce((sum, state) => sum + state.total_orders, 0)

  // Calculate percentages
  const result: any[] = []
  stateMap.forEach((stateData) => {
    stateData.delivered_percent = stateData.total_orders > 0
      ? (stateData.del_count / stateData.total_orders) * 100
      : 0
    
    stateData.rto_percent = stateData.total_orders > 0
      ? (stateData.rto_count / stateData.total_orders) * 100
      : 0
    
    stateData.ndr_percent = stateData.total_orders > 0
      ? (stateData.ndr_count / stateData.total_orders) * 100
      : 0

    stateData.order_share = totalOrders > 0
      ? (stateData.total_orders / totalOrders) * 100
      : 0

    result.push(stateData)
  })

  return result.sort((a, b) => b.total_orders - a.total_orders)
}

/**
 * Compute category share analytics
 */
export function computeCategoryShare(data: ShippingRecord[]): any[] {
  const categoryMap = new Map<string, any>()

  data.forEach((record) => {
    const category = record.category || record.product__category || 'Uncategorized'
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        categoryname: category,
        total_orders: 0,
        total_order_value: 0,
      })
    }

    const categoryData = categoryMap.get(category)!
    categoryData.total_orders++
    categoryData.total_order_value += parseFloat(record.order_value) || 0
  })

  const result: any[] = []
  categoryMap.forEach((categoryData) => {
    result.push(categoryData)
  })

  return result.sort((a, b) => b.total_orders - a.total_orders)
}

/**
 * Compute product analysis analytics
 */
export function computeProductAnalysis(data: ShippingRecord[]): any[] {
  const productMap = new Map<string, any>()

  data.forEach((record) => {
    // Get product name from various possible fields
    const productName = record['Product Name'] || 
                       record.product_name || 
                       record.product__name ||
                       record['product name'] ||
                       record.ProductName ||
                       record.productName ||
                       'Unknown'
    
    if (!productMap.has(productName)) {
      productMap.set(productName, {
        product_name: productName,
        orders: 0,
        delivered: 0,
        rto: 0,
        returned: 0,
        gmv: 0,
        margin: 0, // Currently set to 0 as shown in the image
      })
    }

    const productData = productMap.get(productName)!
    productData.orders++

    // Use original Status field first for accuracy
    const status = String(
      record.original_status ||  // Preserved original Status field
      record['Status'] ||        // Original field name (before normalization)
      record.status ||           // Normalized field name (after normalizeKeys)
      record.delivery_status ||  // Preprocessed field (fallback)
      ''
    ).toUpperCase().trim()
    
    // Get margin from various possible fields
    const marginValue = parseFloat(String(record.margin)) ||
                      parseFloat(String(record['Margin'])) ||
                      parseFloat(String(record.profit)) ||
                      parseFloat(String(record['Profit'])) ||
                      parseFloat(String(record.profit_margin)) ||
                      parseFloat(String(record['Profit Margin'])) ||
                      parseFloat(String(record.margin_amount)) ||
                      parseFloat(String(record['Margin Amount'])) ||
                      0
    
    // Get return status - check if order was returned (after delivery)
    const isReturned = status === 'RETURNED' ||
                      status === 'RETURN' ||
                      status.includes('RETURN') ||
                      String(record.return_status || '').toUpperCase().includes('RETURN') ||
                      String(record['Return Status'] || '').toUpperCase().includes('RETURN')
    
    // Count delivered orders and add GMV (only for delivered orders)
    if (status === 'DELIVERED') {
      productData.delivered++
      // GMV - Only count for DELIVERED orders
      const orderValue = parseFloat(String(record.order_value)) || 
                       parseFloat(String(record.gmv_amount)) ||
                       parseFloat(String(record['Order Total'])) ||
                       parseFloat(String(record.order__total)) ||
                       parseFloat(String(record.total_order_value)) ||
                       0
      productData.gmv += orderValue
      productData.margin += marginValue
      
      // Count returns (only for delivered orders that were later returned)
      if (isReturned) {
        productData.returned++
      }
    }
    
    // Count RTO orders
    if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
        status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
      productData.rto++
    }
  })

  // Calculate total orders for order share percentage
  const totalOrders = Array.from(productMap.values()).reduce((sum, product) => sum + product.orders, 0)

  // Calculate percentages
  const result: any[] = []
  productMap.forEach((productData) => {
    const orderShare = totalOrders > 0 ? (productData.orders / totalOrders) * 100 : 0
    const deliveredPercent = productData.orders > 0 ? (productData.delivered / productData.orders) * 100 : 0
    const rtoPercent = productData.orders > 0 ? (productData.rto / productData.orders) * 100 : 0
    const returnedPercent = productData.delivered > 0 ? (productData.returned / productData.delivered) * 100 : 0

    result.push({
      product_name: productData.product_name,
      orders: productData.orders,
      orderShare: orderShare,
      gmv: productData.gmv,
      margin: productData.margin,
      deliveredPercent: deliveredPercent,
      rtoPercent: rtoPercent,
      returnedPercent: returnedPercent,
    })
  })

  return result.sort((a, b) => b.orders - a.orders) // Sort by orders descending
}

/**
 * Compute cancellation tracker analytics
 */
export function computeCancellationTracker(data: ShippingRecord[]): any[] {
  const cancellationMap = new Map<string, any>()

  data.forEach((record) => {
    const week = record.order_week || 'Unknown'
    const cancellationBucket = record.cancellation__reason || 
                               record.cancellation_reason || 
                               (record.cancelled_flag ? 'Cancelled' : 'Not Canceled')
    
    const key = `${week}:${cancellationBucket}`
    
    if (!cancellationMap.has(key)) {
      cancellationMap.set(key, {
        order_week: week,
        cancellation_bucket: cancellationBucket,
        count: 0,
        percentage: 0,
      })
    }

    cancellationMap.get(key)!.count++
  })

  // Calculate percentages per week
  const weekTotals = new Map<string, number>()
  cancellationMap.forEach((item) => {
    const current = weekTotals.get(item.order_week) || 0
    weekTotals.set(item.order_week, current + item.count)
  })

  const result: any[] = []
  cancellationMap.forEach((item) => {
    const weekTotal = weekTotals.get(item.order_week) || 1
    item.percentage = (item.count / weekTotal) * 100
    result.push(item)
  })

  return result.sort((a, b) => {
    if (a.order_week !== b.order_week) {
      return a.order_week.localeCompare(b.order_week)
    }
    return a.cancellation_bucket.localeCompare(b.cancellation_bucket)
  })
}

/**
 * Compute channel share analytics
 */
export function computeChannelShare(data: ShippingRecord[]): any[] {
  const channelMap = new Map<string, any>()

  data.forEach((record) => {
    const channel = record.channel || 'Unknown'
    
    if (!channelMap.has(channel)) {
      channelMap.set(channel, {
        channel,
        total_orders: 0,
        total_order_value: 0,
      })
    }

    const channelData = channelMap.get(channel)!
    channelData.total_orders++
    channelData.total_order_value += parseFloat(record.order_value) || 0
  })

  const result: any[] = []
  channelMap.forEach((channelData) => {
    result.push(channelData)
  })

  return result.sort((a, b) => b.total_orders - a.total_orders)
}

/**
 * Compute payment method distribution
 */
export function computePaymentMethod(data: ShippingRecord[]): any[] {
  const paymentMap = new Map<string, number>()
  let total = 0

  data.forEach((record) => {
    const paymentMethod = record.payment_method || 
                         record['Payment Method'] || 
                         record.payment__method || 
                         record.paymentmethod || 
                         ''
    const paymentUpper = String(paymentMethod).toUpperCase()
    
    let category = 'NaN'
    if (!paymentMethod || paymentMethod === 'none' || paymentMethod === 'N/A' || paymentMethod === '') {
      category = 'NaN'
    } else if (paymentUpper.includes('COD') || paymentUpper.includes('CASH') || paymentUpper === 'COD') {
      category = 'COD'
    } else if (paymentUpper.includes('ONLINE') || paymentUpper.includes('PREPAID') || paymentUpper.includes('PAID') || paymentUpper === 'ONLINE') {
      category = 'Online'
    } else {
      category = 'NaN'
    }

    const current = paymentMap.get(category) || 0
    paymentMap.set(category, current + 1)
    total++
  })

  const result: any[] = []
  paymentMap.forEach((count, category) => {
    result.push({
      name: category,
      value: total > 0 ? (count / total) * 100 : 0,
      count: count,
    })
  })

  return result.sort((a, b) => b.value - a.value)
}

/**
 * Compute all analytics and save to Redis
 */
export async function computeAllAnalytics(sessionId: string, filters?: FilterParams): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await getShippingDataFromRedis(sessionId)
    
    if (!data || data.length === 0) {
      return { success: false, error: 'No data found in Redis for session. Data may have expired (30 min TTL) or session ID is invalid.' }
    }

    // Apply filters if provided
    const filteredData = filters ? filterShippingData(data, filters) : data
    
    // Debug logging for date filtering (only if DEBUG_ANALYTICS is enabled)
    if (process.env.DEBUG_ANALYTICS === 'true' && filters && (filters.startDate || filters.endDate)) {
      console.log('📊 Date Filter Debug:', {
        totalRecords: data.length,
        filterStartDate: filters.startDate,
        filterEndDate: filters.endDate,
        filteredRecords: filteredData.length,
        sampleDataPoints: data.slice(0, 3).map(r => ({
          order_date: r.order_date,
          shiprocket__created__at: r.shiprocket__created__at,
          'Shiprocket Created At': r['Shiprocket Created At'],
        }))
      })
    }

    // Build filter object for key generation
    const filterObj = filters ? {
      channel: filters.channel,
      sku: filters.sku,
      productName: filters.productName,
      startDate: filters.startDate,
      endDate: filters.endDate,
      orderStatus: filters.orderStatus,
      paymentMethod: filters.paymentMethod,
    } : undefined

    if (filteredData.length === 0) {
      // If filters result in no data, save empty arrays
      const analyticsTypes = [
        'weekly-summary',
        'ndr-weekly',
        'state-performance',
        'category-share',
        'cancellation-tracker',
        'channel-share',
        'payment-method',
        'product-analysis',
      ]
      await Promise.all(
        analyticsTypes.map(type => {
          const key = buildAnalyticsKey(sessionId, type, filterObj)
          const keyPart = key.replace(`analytics:${sessionId}:`, '')
          return saveAnalyticsToRedis(sessionId, keyPart, [])
        })
      )
      return { success: true }
    }

    // Compute all analytics
    const weeklySummary = computeWeeklySummary(filteredData)
    const ndrWeekly = computeNDRWeekly(filteredData)
    const statePerformance = computeStatePerformance(filteredData)
    const categoryShare = computeCategoryShare(filteredData)
    const cancellationTracker = computeCancellationTracker(filteredData)
    const channelShare = computeChannelShare(filteredData)
    const paymentMethod = computePaymentMethod(filteredData)
    const productAnalysis = computeProductAnalysis(filteredData)

    // Save to Redis with new key structure
    const analyticsResults = [
      { type: 'weekly-summary', data: weeklySummary },
      { type: 'ndr-weekly', data: ndrWeekly },
      { type: 'state-performance', data: statePerformance },
      { type: 'category-share', data: categoryShare },
      { type: 'cancellation-tracker', data: cancellationTracker },
      { type: 'channel-share', data: channelShare },
      { type: 'payment-method', data: paymentMethod },
      { type: 'product-analysis', data: productAnalysis },
    ]

    await Promise.all(
      analyticsResults.map(({ type, data }) => {
        const key = buildAnalyticsKey(sessionId, type, filterObj)
        // Extract the part after analytics:sessionId: for saveAnalyticsToRedis
        const keyPart = key.replace(`analytics:${sessionId}:`, '')
        return saveAnalyticsToRedis(sessionId, keyPart, data)
      })
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('Error computing analytics:', error)
    return { success: false, error: error.message || 'Failed to compute analytics' }
  }
}
