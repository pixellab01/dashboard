'use client'

import React, { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import AnalyticsFilters, { FilterState } from '@/app/components/AnalyticsFilters'
import { fetchAnalytics, computeAnalytics } from '@/lib/api-client'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface User {
  email: string
  role: string
  name: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

function AnalyticsDashboardContent() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    orderStatus: 'All',
    paymentMethod: 'All',
    channel: 'All',
    sku: 'All',
    productName: 'All',
  })
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [availableSkus, setAvailableSkus] = useState<string[]>([])
  const [availableSkusTop10, setAvailableSkusTop10] = useState<string[]>([])
  const [availableProductNames, setAvailableProductNames] = useState<string[]>([])
  const [availableProductNamesTop10, setAvailableProductNamesTop10] = useState<string[]>([])
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Data states
  const [weeklySummary, setWeeklySummary] = useState<any[]>([])
  const [rawShippingData, setRawShippingData] = useState<any[]>([])
  const [ndrWeekly, setNdrWeekly] = useState<any[]>([])
  const [statePerformance, setStatePerformance] = useState<any[]>([])
  const [ndrCountData, setNdrCountData] = useState<any[]>([])
  const [categoryShare, setCategoryShare] = useState<any[]>([])
  const [cancellationData, setCancellationData] = useState<any[]>([])
  const [channelShare, setChannelShare] = useState<any[]>([])
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([])
  const [orderStatusesData, setOrderStatusesData] = useState<any[]>([])
  const [paymentMethodOutcomeData, setPaymentMethodOutcomeData] = useState<any[]>([])
  const [statusCategories, setStatusCategories] = useState<string[]>([])
  const [productAnalysisData, setProductAnalysisData] = useState<any[]>([])
  const [addressTypeShareData, setAddressTypeShareData] = useState<any[]>([])
  const [averageOrderTatData, setAverageOrderTatData] = useState<any[]>([])
  const [fadDelCanRtoData, setFadDelCanRtoData] = useState<any[]>([])
  const [cancellationReasonTrackerData, setCancellationReasonTrackerData] = useState<any[]>([])
  const [deliveryPartnerAnalysisData, setDeliveryPartnerAnalysisData] = useState<any[]>([])

  // Summary metrics
  const [summaryMetrics, setSummaryMetrics] = useState({
    syncedOrders: 0,
    gmv: 0,
    inTransitPercent: 0,
    deliveryPercent: 0,
    rtoPercent: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    rtoOrders: 0,
    undeliveredOrders: 0,
  })

  // State search filter
  const [stateSearchQuery, setStateSearchQuery] = useState<string>('')

  // Table view filter (day/week)
  const [tableView, setTableView] = useState<'day' | 'week'>('day')
  
  // Table visibility states
  const [isDeliveryPerformanceVisible, setIsDeliveryPerformanceVisible] = useState(true)
  const [isProductsAnalysisVisible, setIsProductsAnalysisVisible] = useState(true)
  const [isDeliveryByStateVisible, setIsDeliveryByStateVisible] = useState(true)
  const [isNdrCountVisible, setIsNdrCountVisible] = useState(true)
  const [isAddressTypeShareVisible, setIsAddressTypeShareVisible] = useState(true)
  const [isAverageOrderTatVisible, setIsAverageOrderTatVisible] = useState(true)
  const [isFadDelCanRtoVisible, setIsFadDelCanRtoVisible] = useState(true)
  const [isCancellationReasonTrackerVisible, setIsCancellationReasonTrackerVisible] = useState(true)
  const [isDeliveryPartnerAnalysisVisible, setIsDeliveryPartnerAnalysisVisible] = useState(true)
  
  // Separate table view states for each table
  const [productsTableView, setProductsTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [stateTableView, setStateTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [ndrCountTableView, setNdrCountTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [addressTypeShareTableView, setAddressTypeShareTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [averageOrderTatTableView, setAverageOrderTatTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [fadDelCanRtoTableView, setFadDelCanRtoTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [cancellationReasonTrackerTableView, setCancellationReasonTrackerTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [deliveryPartnerAnalysisTableView, setDeliveryPartnerAnalysisTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [selectedDeliveryPartner, setSelectedDeliveryPartner] = useState<string>('All')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/')
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'admin') {
      router.push('/')
      return
    }

    setUser(parsedUser)
    
    // Get sessionId from URL or localStorage
    const urlSessionId = searchParams?.get('sessionId')
    const storedSessionId = localStorage.getItem('analyticsSessionId')
    const currentSessionId = urlSessionId || storedSessionId
    
    if (!currentSessionId) {
      alert('No session ID found. Please read a shipping file first.')
      router.push('/admin')
      return
    }
    
    // If sessionId came from URL, store it in localStorage for future use
    if (urlSessionId && urlSessionId !== storedSessionId) {
      localStorage.setItem('analyticsSessionId', urlSessionId)
      console.log('Session ID stored from URL:', urlSessionId)
    }
    
    setSessionId(currentSessionId)
    setIsLoading(false)
    fetchFilterOptions(currentSessionId)
    fetchAllData(currentSessionId, filters)
  }, [router, searchParams])

  useEffect(() => {
    if (sessionId) {
      fetchAllData(sessionId, filters)
    }
  }, [filters, sessionId])

  const fetchFilterOptions = async (currentSessionId: string) => {
    try {
      const { getFilterOptions } = await import('@/lib/api-client')
      const result = await getFilterOptions(currentSessionId)
      
      if (result.success && result.data) {
        setAvailableChannels(result.data.channels || [])
        setAvailableSkus(result.data.skus || [])
        setAvailableSkusTop10(result.data.skusTop10 || [])
        setAvailableProductNames(result.data.productNames || [])
        setAvailableProductNamesTop10(result.data.productNamesTop10 || [])
        setAvailableStatuses(result.data.statuses || [])
        
        // Debug logging
        console.log('Filter options loaded:', {
          totalSkus: result.data.skus?.length || 0,
          skusTop10: result.data.skusTop10,
          totalProductNames: result.data.productNames?.length || 0,
          productNamesTop10: result.data.productNamesTop10,
        })
        
        // Additional validation
        if (!result.data.productNames || result.data.productNames.length === 0) {
          console.warn('⚠️ No product names found! Check API response:', {
            hasProductNames: !!result.data.productNames,
            productNamesCount: result.data.productNames?.length || 0,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const fetchAllData = async (currentSessionId: string, currentFilters: FilterState) => {
    setLoadingData(true)
    setDataError(null)
    
    // Debug logging for date filters
    if (currentFilters.startDate || currentFilters.endDate) {
      console.log('🔍 Date Filter Applied:', {
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate,
        orderStatus: currentFilters.orderStatus,
        paymentMethod: currentFilters.paymentMethod,
      })
    }
    
    try {
      // Build filter query string
      const filterParams = new URLSearchParams()
      filterParams.append('sessionId', currentSessionId)
      if (currentFilters.startDate) filterParams.append('startDate', currentFilters.startDate)
      if (currentFilters.endDate) filterParams.append('endDate', currentFilters.endDate)
      if (currentFilters.orderStatus !== 'All') filterParams.append('orderStatus', currentFilters.orderStatus)
      if (currentFilters.paymentMethod !== 'All') filterParams.append('paymentMethod', currentFilters.paymentMethod)
      if (currentFilters.channel !== 'All') filterParams.append('channel', currentFilters.channel)
      if (currentFilters.sku && currentFilters.sku !== 'All') {
        const skuArray = Array.isArray(currentFilters.sku) ? currentFilters.sku : [currentFilters.sku]
        skuArray.forEach(sku => filterParams.append('sku', sku))
      }
      if (currentFilters.productName && currentFilters.productName !== 'All') {
        const productNameArray = Array.isArray(currentFilters.productName) ? currentFilters.productName : [currentFilters.productName]
        productNameArray.forEach(productName => filterParams.append('productName', productName))
      }

      // Import getRawShippingData for parallel fetching
      const { getRawShippingData } = await import('@/lib/api-client')

      // Fetch all analytics data from Python backend (including raw shipping data)
      const [
        weeklyData,
        ndrData,
        stateData,
        categoryData,
        cancellationData,
        channelData,
        paymentData,
        summaryData,
        statusesData,
        paymentOutcomeData,
        productAnalysisData,
        ndrCountData,
        addressTypeShareData,
        averageOrderTatData,
        fadDelCanRtoData,
        cancellationReasonTrackerData,
        deliveryPartnerAnalysisData,
        rawShippingDataResult,
      ] = await Promise.all([
        fetchAnalytics('weekly-summary', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('ndr-weekly', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('state-performance', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('category-share', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('cancellation-tracker', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('channel-share', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('payment-method', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('summary-metrics', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('order-statuses', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('payment-method-outcome', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('product-analysis', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('ndr-count', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('address-type-share', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('average-order-tat', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('fad-del-can-rto', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('cancellation-reason-tracker', { sessionId: currentSessionId, ...currentFilters }),
        fetchAnalytics('delivery-partner-analysis', { sessionId: currentSessionId, ...currentFilters }),
        getRawShippingData(currentSessionId, {
          startDate: currentFilters.startDate,
          endDate: currentFilters.endDate,
          orderStatus: currentFilters.orderStatus !== 'All' ? currentFilters.orderStatus : undefined,
          paymentMethod: currentFilters.paymentMethod !== 'All' ? currentFilters.paymentMethod : undefined,
          channel: currentFilters.channel !== 'All' ? currentFilters.channel : undefined,
          sku: currentFilters.sku !== 'All' ? (Array.isArray(currentFilters.sku) ? currentFilters.sku : [currentFilters.sku]) : undefined,
          productName: currentFilters.productName !== 'All' ? (Array.isArray(currentFilters.productName) ? currentFilters.productName : [currentFilters.productName]) : undefined,
        }),
      ])

      // Set data immediately for successful APIs (progressive loading - show data as it arrives)
      if (weeklyData.success) setWeeklySummary(Array.isArray(weeklyData.data) ? weeklyData.data : [])
      if (ndrData.success) setNdrWeekly(Array.isArray(ndrData.data) ? ndrData.data : [])
      if (stateData.success) setStatePerformance(Array.isArray(stateData.data) ? stateData.data : [])
      if (categoryData.success) setCategoryShare(Array.isArray(categoryData.data) ? categoryData.data : [])
      if (cancellationData.success) setCancellationData(Array.isArray(cancellationData.data) ? cancellationData.data : [])
      if (channelData.success) setChannelShare(Array.isArray(channelData.data) ? channelData.data : [])
      if (paymentData.success) setPaymentMethodData(Array.isArray(paymentData.data) ? paymentData.data : [])
      if (statusesData.success) {
        const data = statusesData.data
        // Ensure data is an array
        setOrderStatusesData(Array.isArray(data) ? data : [])
      }
      if (paymentOutcomeData.success) {
        setPaymentMethodOutcomeData(Array.isArray(paymentOutcomeData.data) ? paymentOutcomeData.data : [])
        const data = paymentOutcomeData.data as any
        if (data && typeof data === 'object' && 'statusCategories' in data) {
          setStatusCategories(Array.isArray(data.statusCategories) ? data.statusCategories : [])
        }
      }
      if (productAnalysisData.success) setProductAnalysisData(Array.isArray(productAnalysisData.data) ? productAnalysisData.data : [])
      if (ndrCountData.success) setNdrCountData(Array.isArray(ndrCountData.data) ? ndrCountData.data : [])
      if (addressTypeShareData.success) setAddressTypeShareData(Array.isArray(addressTypeShareData.data) ? addressTypeShareData.data : [])
      if (averageOrderTatData.success) setAverageOrderTatData(Array.isArray(averageOrderTatData.data) ? averageOrderTatData.data : [])
      if (fadDelCanRtoData.success) setFadDelCanRtoData(Array.isArray(fadDelCanRtoData.data) ? fadDelCanRtoData.data : [])
      if (cancellationReasonTrackerData.success) setCancellationReasonTrackerData(Array.isArray(cancellationReasonTrackerData.data) ? cancellationReasonTrackerData.data : [])
      if (deliveryPartnerAnalysisData.success) setDeliveryPartnerAnalysisData(Array.isArray(deliveryPartnerAnalysisData.data) ? deliveryPartnerAnalysisData.data : [])
      
      // Set raw shipping data (for Day view)
      if (rawShippingDataResult.success && rawShippingDataResult.data) {
        const data = rawShippingDataResult.data || []
        console.log('Raw shipping data fetched:', {
          count: data.length,
          sampleRecord: data[0],
          sampleKeys: data[0] ? Object.keys(data[0]).slice(0, 15) : []
        })
        setRawShippingData(data)
      } else {
        console.error('Failed to fetch raw shipping data:', rawShippingDataResult.error)
      }

      // Set summary metrics from API
      if (summaryData.success) {
        // Handle both formats: summaryData.metrics or summaryData.data
        const data = summaryData.data as any
        const metrics = (data && typeof data === 'object' && 'metrics' in data) ? data.metrics : (data || {})
        setSummaryMetrics({
          syncedOrders: metrics?.syncedOrders || metrics?.total_orders || 0,
          gmv: metrics?.gmv || metrics?.total_gmv || 0,
          inTransitPercent: metrics?.inTransitPercent || 0,
          deliveryPercent: metrics?.deliveryPercent || metrics?.delivery_rate || 0,
          rtoPercent: metrics?.rtoPercent || metrics?.rto_rate || 0,
          inTransitOrders: metrics?.inTransitOrders || 0,
          deliveredOrders: metrics?.deliveredOrders || metrics?.total_delivered || 0,
          rtoOrders: metrics?.rtoOrders || metrics?.total_rto || 0,
          undeliveredOrders: metrics?.undeliveredOrders || 0,
        })
      }

      // Check if analytics need to be computed or if there are errors (include all APIs)
      const hasErrors = 
        (!weeklyData.success && weeklyData.error) || 
        (!ndrData.success && ndrData.error) || 
        (!stateData.success && stateData.error) || 
        (!categoryData.success && categoryData.error) || 
        (!cancellationData.success && cancellationData.error) || 
        (!channelData.success && channelData.error) ||
        (!paymentData.success && paymentData.error) ||
        (!summaryData.success && summaryData.error) ||
        (!statusesData.success && statusesData.error) ||
        (!paymentOutcomeData.success && paymentOutcomeData.error) ||
        (!productAnalysisData.success && productAnalysisData.error) ||
        (!ndrCountData.success && ndrCountData.error) ||
        (!addressTypeShareData.success && addressTypeShareData.error) ||
        (!averageOrderTatData.success && averageOrderTatData.error) ||
        (!fadDelCanRtoData.success && fadDelCanRtoData.error) ||
        (!cancellationReasonTrackerData.success && cancellationReasonTrackerData.error) ||
        (!deliveryPartnerAnalysisData.success && deliveryPartnerAnalysisData.error)

      const needsComputation = 
        !weeklyData.success || 
        !ndrData.success || 
        !stateData.success || 
        !categoryData.success || 
        !cancellationData.success || 
        !channelData.success ||
        !paymentData.success ||
        !summaryData.success ||
        !statusesData.success ||
        !paymentOutcomeData.success ||
        !productAnalysisData.success ||
        !ndrCountData.success ||
        !addressTypeShareData.success ||
        !averageOrderTatData.success ||
        !fadDelCanRtoData.success ||
        !cancellationReasonTrackerData.success ||
        !deliveryPartnerAnalysisData.success

      // If there are errors indicating data expired, show message
      if (hasErrors && currentSessionId) {
        const errorMessage = weeklyData.error || ndrData.error || stateData.error || summaryData.error || 'Data may have expired'
        if (errorMessage.includes('expired') || errorMessage.includes('No data found')) {
          setDataError('Data has expired (30 min TTL) or session is invalid. Please read the shipping file again.')
          console.warn('Data expired or not found. Please read the file again.')
          // Still try to compute if possible
        }
      }

      // Compute analytics in background if needed (non-blocking - don't wait for it)
      if (needsComputation && currentSessionId) {
        // Fire and forget - don't block UI rendering
        computeAnalytics(currentSessionId, currentFilters)
          .then((computeResult) => {
            if (computeResult.success) {
              // Retry fetching after computation completes (reduced delay for faster refresh)
              setTimeout(() => {
                fetchAllData(currentSessionId, currentFilters)
              }, 500)
            } else {
              console.error('Failed to compute analytics:', computeResult.error)
            }
          })
          .catch((error) => {
            console.error('Error computing analytics:', error)
          })
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // Note: rawShippingData is now fetched in fetchAllData() along with other analytics data
  // This ensures Day and Week views load data at the same time

  // Helper function to format date
  const formatDate = (dateStr: string, isDayView: boolean = false): string => {
    try {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const day = date.getDate()
      const year = date.getFullYear()
      
      if (isDayView) {
        // For day view: "Nov 16 2025" or "Dec 10"
        return `${month} ${day} ${year}`
      } else {
        // For week view: use the week string as-is or format it
        return dateStr
      }
    } catch (e) {
      return dateStr
    }
  }

  // Aggregate data by day from raw shipping records
  const aggregateByDay = (records: any[]): any[] => {
    const dayMap = new Map<string, { orders: number; gmv: number }>()
    
    records.forEach((record: any) => {
      // Get order date from various possible fields
      let orderDateValue: any = null
      
      if (record.order_date) {
        orderDateValue = record.order_date
      } else if (record.order__date) {
        orderDateValue = record.order__date
      } else if (record['Order Date']) {
        orderDateValue = record['Order Date']
      } else if (record['Shiprocket Created At']) {
        orderDateValue = record['Shiprocket Created At']
      } else if (record.shiprocket__created__at) {
        orderDateValue = record.shiprocket__created__at
      } else if (record.channel__created__at) {
        orderDateValue = record.channel__created__at
      }
      
      if (!orderDateValue) return
      
      // Convert to YYYY-MM-DD format
      let dateStr: string
      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateStr = orderDateValue
      } else {
        try {
          const date = new Date(orderDateValue)
          if (isNaN(date.getTime())) return
          dateStr = date.toISOString().split('T')[0]
        } catch (e) {
          return
        }
      }
      
      // Get status to check if delivered
      const status = String(
        record.original_status ||  // Preserved original Status field
        record['Status'] ||        // Original field name (before normalization)
        record.status ||           // Normalized field name (after normalizeKeys)
        record.delivery_status ||  // Preprocessed field (fallback)
        ''
      ).toUpperCase().trim()
      
      const existing = dayMap.get(dateStr) || { orders: 0, gmv: 0 }
      
      // Count all orders
      existing.orders += 1
      
      // GMV - Only count for DELIVERED orders
      if (status === 'DELIVERED') {
        const gmvAmount = record.gmv_amount || 
                         record.order_value || 
                         record['Order Total'] ||
                         record.order__total ||
                         record.total_order_value ||
                         0
        const gmv = parseFloat(String(gmvAmount)) || 0
        existing.gmv += gmv
      }
      
      dayMap.set(dateStr, existing)
    })
    
    return Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date: formatDate(date, true),
        orders: data.orders,
        gmv: data.gmv,
        sortDate: date // For sorting
      }))
      .sort((a, b) => a.sortDate.localeCompare(b.sortDate))
      .map(({ sortDate, ...rest }) => rest) // Remove sortDate from final output
  }

  // Aggregate daily delivery performance data
  const aggregateDailyDeliveryPerformance = (records: any[]): any[] => {
    const dayMap = new Map<string, { 
      orders: number
      delivered: number
      rto: number
      gmv: number
      sortDate: string
    }>()
    
    if (!records || records.length === 0) {
      console.warn('aggregateDailyDeliveryPerformance: No records provided')
      return []
    }
    
    records.forEach((record: any) => {
      // Get order date from various possible fields (check both normalized and original names)
      let orderDateValue: any = null
      
      // Try normalized snake_case fields first (from backend normalization)
      if (record.shiprocket_created_at) {
        orderDateValue = record.shiprocket_created_at
      } else if (record.channel_created_at) {
        orderDateValue = record.channel_created_at
      } else if (record.order_date) {
        orderDateValue = record.order_date
      } else if (record.order_created_at) {
        orderDateValue = record.order_created_at
      }
      // Try original field names (with spaces)
      else if (record['Shiprocket Created At']) {
        orderDateValue = record['Shiprocket Created At']
      } else if (record['Order Date']) {
        orderDateValue = record['Order Date']
      } else if (record['Channel Created At']) {
        orderDateValue = record['Channel Created At']
      }
      // Try double underscore variants (legacy)
      else if (record.shiprocket__created__at) {
        orderDateValue = record.shiprocket__created__at
      } else if (record.channel__created__at) {
        orderDateValue = record.channel__created__at
      } else if (record.order__date) {
        orderDateValue = record.order__date
      }
      
      if (!orderDateValue) {
        // Log first few missing dates for debugging
        if (dayMap.size === 0) {
          console.warn('aggregateDailyDeliveryPerformance: Record missing date field:', {
            keys: Object.keys(record).slice(0, 10),
            sampleRecord: record
          })
        }
        return
      }
      
      // Convert to YYYY-MM-DD format
      let dateStr: string
      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateStr = orderDateValue
      } else {
        try {
          const date = new Date(orderDateValue)
          if (isNaN(date.getTime())) return
          dateStr = date.toISOString().split('T')[0]
        } catch (e) {
          return
        }
      }
      
      // Get status
      const status = String(
        record.original_status ||  // Preserved original Status field
        record['Status'] ||        // Original field name (before normalization)
        record.status ||           // Normalized field name (after normalizeKeys)
        record.delivery_status ||  // Preprocessed field (fallback)
        ''
      ).toUpperCase().trim()
      
      const existing = dayMap.get(dateStr) || { 
        orders: 0, 
        delivered: 0, 
        rto: 0,
        gmv: 0,
        sortDate: dateStr
      }
      
      // Count all orders
      existing.orders += 1
      
      // Count delivered orders and add GMV (only for delivered orders)
      if (status === 'DELIVERED') {
        existing.delivered += 1
        // GMV - Only count for DELIVERED orders
        const gmvAmount = record.gmv_amount || 
                         record.order_value || 
                         record['Order Total'] ||
                         record.order__total ||
                         record.total_order_value ||
                         0
        existing.gmv += parseFloat(String(gmvAmount)) || 0
      }
      
      // Count RTO orders
      if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
          status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
        existing.rto += 1
      }
      
      dayMap.set(dateStr, existing)
    })
    
    // Calculate total orders for order share percentage
    const totalOrders = Array.from(dayMap.values()).reduce((sum, day) => sum + day.orders, 0)
    
    const result = Array.from(dayMap.entries())
      .map(([date, data]) => {
        // Calculate percentages
        const finalOrders = data.delivered + data.rto + (data.orders - data.delivered - data.rto)
        const deliveredPercent = finalOrders > 0 ? (data.delivered / finalOrders) * 100 : 0
        const rtoPercent = finalOrders > 0 ? (data.rto / finalOrders) * 100 : 0
        const orderSharePercent = totalOrders > 0 ? (data.orders / totalOrders) * 100 : 0
        
        // Format date as "DD Mon YYYY"
        let formattedDate = date
        try {
          const dateObj = new Date(date)
          if (!isNaN(dateObj.getTime())) {
            const day = dateObj.getDate()
            const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
            const year = dateObj.getFullYear()
            formattedDate = `${day} ${month} ${year}`
          }
        } catch (e) {
          // Keep original format if parsing fails
        }
        
        return {
          date: formattedDate,
          orders: data.orders,
          orderShare: orderSharePercent,
          deliveredPercent: deliveredPercent,
          rtoPercent: rtoPercent,
          gmv: data.gmv,
          sortDate: date
        }
      })
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate)) // Sort descending (newest first)
      .map(({ sortDate, ...rest }) => rest) // Remove sortDate from final output
    
    console.log('aggregateDailyDeliveryPerformance result:', {
      inputRecords: records.length,
      outputDays: result.length,
      totalOrders,
      sampleResult: result.slice(0, 3),
      dayMapSize: dayMap.size
    })
    
    return result
  }

  // Aggregate weekly delivery performance data
  const aggregateWeeklyDeliveryPerformance = (weeklyData: any[]): any[] => {
    // Calculate total orders across all weeks for order share percentage
    const totalOrders = weeklyData.reduce((sum, week) => sum + (week.total_orders || 0), 0)
    
    return weeklyData.map((week) => {
      const orders = week.total_orders || 0
      const delivered = week.del_count || 0
      const rto = week.rto_count || 0
      const gmv = week.total_order_value || 0 // Already filtered to delivered only
      
      // Calculate percentages
      const finalOrders = delivered + rto + (orders - delivered - rto)
      const deliveredPercent = finalOrders > 0 ? (delivered / finalOrders) * 100 : 0
      const rtoPercent = finalOrders > 0 ? (rto / finalOrders) * 100 : 0
      const orderSharePercent = totalOrders > 0 ? (orders / totalOrders) * 100 : 0
      
      // Format date range (format: "YYYY-MM-DD-DD" e.g., "2025-12-01-07")
      let formattedDate = week.order_week || ''
      try {
        if (formattedDate) {
          // Parse the week range format "YYYY-MM-DD-DD" (e.g., "2025-12-01-07")
          const weekRangeMatch = formattedDate.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/)
          if (weekRangeMatch) {
            const [, year, month, startDay, endDay] = weekRangeMatch
            // Remove leading zeros from day numbers
            const startDayNum = parseInt(startDay, 10)
            const endDayNum = parseInt(endDay, 10)
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
            formattedDate = `${startDayNum}-${endDayNum} ${monthName} ${year}`
          } else {
            // Handle old format (YYYY-WW) - convert to date range
            const oldFormatMatch = formattedDate.match(/^(\d{4})-W(\d{2})$/)
            if (oldFormatMatch) {
              // For old format, we can't accurately convert without more context
              // So we'll show it as-is for now
              formattedDate = `Week ${parseInt(oldFormatMatch[2], 10)} ${oldFormatMatch[1]}`
            } else {
              // Try parsing as regular date string (YYYY-MM-DD)
              const dateMatch = formattedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
              if (dateMatch) {
                const [, year, month, day] = dateMatch
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                if (!isNaN(date.getTime())) {
                  const dayNum = date.getDate()
                  const monthName = date.toLocaleDateString('en-US', { month: 'short' })
                  const yearNum = date.getFullYear()
                  formattedDate = `${dayNum} ${monthName} ${yearNum}`
                }
              } else {
                // Try parsing as Date object
                const date = new Date(formattedDate)
                if (!isNaN(date.getTime())) {
                  const day = date.getDate()
                  const month = date.toLocaleDateString('en-US', { month: 'short' })
                  const year = date.getFullYear()
                  formattedDate = `${day} ${month} ${year}`
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error formatting week date:', e, formattedDate)
        // Keep original format if parsing fails
      }
      
      return {
        date: formattedDate || week.order_week || 'Unknown',
        orders: orders,
        orderShare: orderSharePercent,
        deliveredPercent: deliveredPercent,
        rtoPercent: rtoPercent,
        gmv: gmv,
        sortDate: week.order_week || ''
      }
    })
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate)) // Sort descending (newest first)
    .map(({ sortDate, ...rest }) => rest) // Remove sortDate from final output
  }

  // Prepare daily delivery performance data based on table view
  const dailyDeliveryPerformance = useMemo(() => {
    if (tableView === 'day') {
      return rawShippingData.length > 0 
        ? aggregateDailyDeliveryPerformance(rawShippingData)
        : []
    } else {
      return weeklySummary.length > 0
        ? aggregateWeeklyDeliveryPerformance(weeklySummary)
        : []
    }
  }, [tableView, rawShippingData, weeklySummary])

  // Aggregate products by day/week/overall - returns format similar to NDR Count
  const aggregateProductsByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const productMap = new Map<string, Map<string, any>>()

    records.forEach((record: any) => {
      // Get product name
      const productName = record['Product Name'] || 
                         record.product_name || 
                         record.product__name ||
                         record['product name'] ||
                         record.ProductName ||
                         record.productName ||
                         'Unknown'
      
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Initialize product map if not exists
      if (!productMap.has(productName)) {
        productMap.set(productName, new Map())
      }

      const timeMap = productMap.get(productName)!
      
      // Initialize time period if not exists
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          orders: 0,
          delivered: 0,
          rto: 0,
          returned: 0,
          gmv: 0,
          margin: 0,
        })
      }

      const productData = timeMap.get(timeKey)!
      productData.orders++

      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
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
      
      if (status === 'DELIVERED') {
        productData.delivered++
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
      
      if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
          status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
        productData.rto++
      }
    })

    // Convert to array format: [{ product_name, timePeriods: [{ timeKey, orders, gmv, deliveredPercent, rtoPercent, margin, returnedPercent }] }]
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    
    productMap.forEach((timeMap) => {
      timeMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))
    
    // Calculate total orders across all products for order share
    const totalOrdersMap = new Map<string, number>()
    productMap.forEach((timeMap) => {
      timeMap.forEach((data, timeKey) => {
        const currentTotal = totalOrdersMap.get(timeKey) || 0
        totalOrdersMap.set(timeKey, currentTotal + data.orders)
      })
    })
    
    productMap.forEach((timeMap, productName) => {
      const timePeriods: any[] = []
      
      if (view === 'overall') {
        const overallData = timeMap.get('overall') || { orders: 0, delivered: 0, rto: 0, returned: 0, gmv: 0, margin: 0 }
        const totalOrders = totalOrdersMap.get('overall') || overallData.orders
        const orderShare = totalOrders > 0 ? (overallData.orders / totalOrders) * 100 : 0
        const deliveredPercent = overallData.orders > 0 ? (overallData.delivered / overallData.orders) * 100 : 0
        const rtoPercent = overallData.orders > 0 ? (overallData.rto / overallData.orders) * 100 : 0
        const returnedPercent = overallData.delivered > 0 ? (overallData.returned / overallData.delivered) * 100 : 0
        
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          orders: overallData.orders,
          orderShare: orderShare,
          gmv: overallData.gmv,
          deliveredPercent: deliveredPercent,
          rtoPercent: rtoPercent,
          margin: overallData.margin,
          returnedPercent: returnedPercent,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = timeMap.get(timeKey) || { orders: 0, delivered: 0, rto: 0, returned: 0, gmv: 0, margin: 0 }
          const totalOrders = totalOrdersMap.get(timeKey) || 0
          const orderShare = totalOrders > 0 ? (data.orders / totalOrders) * 100 : 0
          const deliveredPercent = data.orders > 0 ? (data.delivered / data.orders) * 100 : 0
          const rtoPercent = data.orders > 0 ? (data.rto / data.orders) * 100 : 0
          const returnedPercent = data.delivered > 0 ? (data.returned / data.delivered) * 100 : 0
          
          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }
          
          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            orders: data.orders,
            orderShare: orderShare,
            gmv: data.gmv,
            deliveredPercent: deliveredPercent,
            rtoPercent: rtoPercent,
            margin: data.margin,
            returnedPercent: returnedPercent,
          })
        })
      }
      
      result.push({
        product_name: productName,
        timePeriods: timePeriods,
      })
    })

    // Sort by total orders (descending) - sum across all time periods
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.orders, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.orders, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Aggregate states by day/week/overall - returns format similar to NDR Count
  const aggregateStatesByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const stateMap = new Map<string, Map<string, any>>()

    records.forEach((record: any) => {
      const state = record.state || record.address__state || 'Unknown'
      
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Initialize state map if not exists
      if (!stateMap.has(state)) {
        stateMap.set(state, new Map())
      }

      const timeMap = stateMap.get(state)!
      
      // Initialize time period if not exists
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          total_orders: 0,
          del_count: 0,
          rto_count: 0,
        })
      }

      const stateData = timeMap.get(timeKey)!
      stateData.total_orders++

      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        ''
      ).toUpperCase().trim()
      
      if (status === 'DELIVERED') {
        stateData.del_count++
      } else if (status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
          status === 'RTO IN TRANSIT' || status === 'RTO NDR') {
        stateData.rto_count++
      }
    })

    // Convert to array format: [{ state, timePeriods: [{ timeKey, total_orders, del_count, rto_count, delivered_percent, rto_percent, orderShare }] }]
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    
    stateMap.forEach((timeMap) => {
      timeMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))
    
    // Calculate total orders across all states for order share
    const totalOrdersMap = new Map<string, number>()
    stateMap.forEach((timeMap) => {
      timeMap.forEach((data, timeKey) => {
        const currentTotal = totalOrdersMap.get(timeKey) || 0
        totalOrdersMap.set(timeKey, currentTotal + data.total_orders)
      })
    })
    
    stateMap.forEach((timeMap, state) => {
      const timePeriods: any[] = []
      
      if (view === 'overall') {
        const overallData = timeMap.get('overall') || { total_orders: 0, del_count: 0, rto_count: 0 }
        const totalOrders = totalOrdersMap.get('overall') || overallData.total_orders
        const orderShare = totalOrders > 0 ? (overallData.total_orders / totalOrders) * 100 : 0
        const deliveredPercent = overallData.total_orders > 0 ? (overallData.del_count / overallData.total_orders) * 100 : 0
        const rtoPercent = overallData.total_orders > 0 ? (overallData.rto_count / overallData.total_orders) * 100 : 0
        
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          total_orders: overallData.total_orders,
          del_count: overallData.del_count,
          rto_count: overallData.rto_count,
          delivered_percent: deliveredPercent,
          rto_percent: rtoPercent,
          orderShare: orderShare,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = timeMap.get(timeKey) || { total_orders: 0, del_count: 0, rto_count: 0 }
          const totalOrders = totalOrdersMap.get(timeKey) || 0
          const orderShare = totalOrders > 0 ? (data.total_orders / totalOrders) * 100 : 0
          const deliveredPercent = data.total_orders > 0 ? (data.del_count / data.total_orders) * 100 : 0
          const rtoPercent = data.total_orders > 0 ? (data.rto_count / data.total_orders) * 100 : 0
          
          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }
          
          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            total_orders: data.total_orders,
            del_count: data.del_count,
            rto_count: data.rto_count,
            delivered_percent: deliveredPercent,
            rto_percent: rtoPercent,
            orderShare: orderShare,
          })
        })
      }
      
      result.push({
        state: state,
        timePeriods: timePeriods,
      })
    })

    // Sort by total orders (descending) - sum across all time periods
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Prepare products and states data based on view
  // For day/week/overall views, aggregate from raw data. For overall, use aggregated data from API if available
  // Convert API data format to timePeriods format if needed
  const convertApiDataToTimePeriods = (apiData: any, type: 'products' | 'states'): any[] => {
    // Handle null, undefined, or non-array data
    if (!apiData) return []
    
    // If apiData is an object with a data property, extract it
    if (typeof apiData === 'object' && !Array.isArray(apiData)) {
      if (apiData.data && Array.isArray(apiData.data)) {
        apiData = apiData.data
      } else if (apiData.success && Array.isArray(apiData.data)) {
        apiData = apiData.data
      } else {
        // If it's an object but not the expected format, return empty array
        console.warn(`convertApiDataToTimePeriods: Expected array but got object:`, apiData)
        return []
      }
    }
    
    // Ensure apiData is an array
    if (!Array.isArray(apiData)) {
      console.warn(`convertApiDataToTimePeriods: Expected array but got ${typeof apiData}:`, apiData)
      return []
    }
    
    if (apiData.length === 0) return []
    
    // Check if data already has timePeriods structure
    if (apiData[0]?.timePeriods) return apiData
    
    // Convert old format to new format
    if (type === 'products') {
      return apiData.map((item: any) => ({
        product_name: item.product_name,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          orders: item.orders || 0,
          orderShare: item.orderShare || 0,
          gmv: item.gmv || 0,
          deliveredPercent: item.deliveredPercent || 0,
          rtoPercent: item.rtoPercent || 0,
          margin: item.margin || 0,
          returnedPercent: item.returnedPercent || 0,
        }]
      }))
    } else {
      return apiData.map((item: any) => ({
        state: item.state,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          total_orders: item.total_orders || 0,
          del_count: item.del_count || 0,
          rto_count: item.rto_count || 0,
          delivered_percent: item.delivered_percent || 0,
          rto_percent: item.rto_percent || 0,
          orderShare: item.order_share || 0,
        }]
      }))
    }
  }
  
  const productsDataByView = rawShippingData.length > 0
    ? aggregateProductsByTime(rawShippingData, productsTableView)
    : (productsTableView === 'overall' ? convertApiDataToTimePeriods(productAnalysisData, 'products') : [])
  
  const statesDataByView = rawShippingData.length > 0
    ? aggregateStatesByTime(rawShippingData, stateTableView)
    : (stateTableView === 'overall' ? convertApiDataToTimePeriods(statePerformance, 'states') : [])
  
  // Get all unique time periods for column headers (similar to NDR Count)
  const productsTimePeriods = productsDataByView.length > 0 && productsTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        productsDataByView.forEach((item) => {
          item.timePeriods?.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  const statesTimePeriods = statesDataByView.length > 0 && stateTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        statesDataByView.forEach((item) => {
          item.timePeriods?.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  // Check if we're showing time-based data (has time column)
  const productsShowTime = productsTableView === 'day' || productsTableView === 'week'
  const statesShowTime = stateTableView === 'day' || stateTableView === 'week'

  // Aggregate NDR count by reason and time period
  const aggregateNdrCountByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const ndrMap = new Map<string, Map<string, { delivered: number; total: number }>>()

    records.forEach((record: any) => {
      // Only process records with NDR flag
      if (!record.ndr_flag) return

      // Get NDR reason/description
      const ndrReason = record.latest__n_d_r__reason || 
                       record.latest_ndr_reason || 
                       record.ndr_reason ||
                       record['Latest NDR Reason'] ||
                       record['NDR Reason'] ||
                       'Unknown Exception'
      
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Initialize reason map if not exists
      if (!ndrMap.has(ndrReason)) {
        ndrMap.set(ndrReason, new Map())
      }

      const reasonMap = ndrMap.get(ndrReason)!
      
      // Initialize time period if not exists
      if (!reasonMap.has(timeKey)) {
        reasonMap.set(timeKey, { delivered: 0, total: 0 })
      }

      const timeData = reasonMap.get(timeKey)!
      timeData.total++

      // Check if delivered after NDR
      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        ''
      ).toUpperCase().trim()
      
      if (status === 'DELIVERED') {
        timeData.delivered++
      }
    })

    // Convert to array format: [{ reason, timePeriods: [{ time, delivered, total }] }]
    const result: any[] = []
    ndrMap.forEach((reasonMap, reason) => {
      const timePeriods: any[] = []
      reasonMap.forEach((data, timeKey) => {
        let formattedTime = timeKey
        if (view === 'day' && timeKey !== 'overall') {
          try {
            const dateObj = new Date(timeKey)
            if (!isNaN(dateObj.getTime())) {
              const day = dateObj.getDate()
              const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
              const year = dateObj.getFullYear()
              formattedTime = `${day} ${month} ${year}`
            }
          } catch (e) {
            // Keep original
          }
        } else if (view === 'week' && timeKey !== 'overall') {
          formattedTime = formatDate(timeKey, false)
        } else if (view === 'overall') {
          formattedTime = null
        }
        
        timePeriods.push({
          time: formattedTime,
          timeKey: timeKey,
          delivered: data.delivered,
          total: data.total,
        })
      })
      
      // Sort time periods by timeKey (newest first for day/week, or keep overall first)
      timePeriods.sort((a, b) => {
        if (view === 'overall') return 0
        return b.timeKey.localeCompare(a.timeKey)
      })
      
      result.push({
        reason: reason,
        timePeriods: timePeriods,
      })
    })

    // Sort by total NDR count (descending) - sum across all time periods
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.total, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.total, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Prepare NDR count data based on view
  // Use API data for overall view, local computation for day/week views
  const ndrCountDataByView = useMemo(() => {
    if (ndrCountTableView === 'overall' && ndrCountData.length > 0) {
      // Transform API data to match expected format
      return ndrCountData.map((item: any) => ({
        reason: item.reason,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          delivered: item.delivered,
          total: item.total,
        }],
      }))
    } else if (rawShippingData.length > 0) {
      return aggregateNdrCountByTime(rawShippingData, ndrCountTableView)
    }
    return []
  }, [ndrCountTableView, ndrCountData, rawShippingData])
  
  // Get all unique time periods for column headers
  const ndrCountTimePeriods = ndrCountDataByView.length > 0
    ? (() => {
        const timeSet = new Set<string>()
        ndrCountDataByView.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  const ndrCountShowTime = ndrCountTableView === 'day' || ndrCountTableView === 'week'

  // Aggregate address type share by time period
  const aggregateAddressTypeShareByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const addressTypeMap = new Map<string, Map<string, number>>()
    const timePeriodRecordCounts = new Map<string, number>() // Track total records per time period

    records.forEach((record: any) => {
      // Get address quality/type
      const addressType = record.address_quality || 
                         record['Address Quality'] ||
                         record.address__quality ||
                         'GOOD' // Default to GOOD if not specified
      
      // Map to display names
      const addressTypeName = addressType === 'INVALID' ? 'Invalid Address%' :
                              addressType === 'SHORT' ? 'Short Address %' :
                              'Good Address %'
      
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Count total records per time period
      const currentCount = timePeriodRecordCounts.get(timeKey) || 0
      timePeriodRecordCounts.set(timeKey, currentCount + 1)

      // Initialize address type map if not exists
      if (!addressTypeMap.has(addressTypeName)) {
        addressTypeMap.set(addressTypeName, new Map())
      }

      const typeMap = addressTypeMap.get(addressTypeName)!
      
      // Initialize time period if not exists
      if (!typeMap.has(timeKey)) {
        typeMap.set(timeKey, 0)
      }

      const count = typeMap.get(timeKey)!
      typeMap.set(timeKey, count + 1)
    })

    // Convert to array format and calculate percentages
    const result: any[] = []
    
    // Get all unique time periods
    const allTimePeriods = new Set<string>()
    addressTypeMap.forEach((typeMap) => {
      typeMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a)) // Newest first
    
    // Calculate overall total (total number of records)
    const overallTotal = records.length

    // Build result array
    const addressTypes = ['Invalid Address%', 'Short Address %', 'Good Address %']
    addressTypes.forEach((addressTypeName) => {
      const typeMap = addressTypeMap.get(addressTypeName) || new Map()
      const timePeriods: any[] = []
      
      if (view === 'overall') {
        const overallCount = Array.from(typeMap.values()).reduce((sum, count) => sum + count, 0)
        const overallPercent = overallTotal > 0 ? (overallCount / overallTotal) * 100 : 0
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          percent: overallPercent,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const count = typeMap.get(timeKey) || 0
          const total = timePeriodRecordCounts.get(timeKey) || 0
          const percent = total > 0 ? (count / total) * 100 : 0
          
          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }
          
          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            percent: percent,
          })
        })
      }
      
      result.push({
        addressType: addressTypeName,
        timePeriods: timePeriods,
      })
    })

    return result
  }

  // Prepare address type share data based on view
  // Use API data for overall view, local computation for day/week views
  const addressTypeShareDataByView = useMemo(() => {
    if (addressTypeShareTableView === 'overall' && addressTypeShareData.length > 0) {
      // Transform API data to match expected format
      return addressTypeShareData.map((item: any) => ({
        addressType: item.addressType,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          percent: item.percent,
        }],
      }))
    } else if (rawShippingData.length > 0) {
      return aggregateAddressTypeShareByTime(rawShippingData, addressTypeShareTableView)
    }
    return []
  }, [addressTypeShareTableView, addressTypeShareData, rawShippingData])
  
  // Get all unique time periods for column headers
  const addressTypeShareTimePeriods = addressTypeShareDataByView.length > 0 && addressTypeShareTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        addressTypeShareDataByView.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  const addressTypeShareShowTime = addressTypeShareTableView === 'day' || addressTypeShareTableView === 'week'

  // Helper function to calculate TAT in days from hours
  const convertTatToDays = (tatHours: number | null | undefined): number | null => {
    if (tatHours === null || tatHours === undefined || isNaN(tatHours)) return null
    return tatHours / 24 // Convert hours to days
  }

  // Helper function to parse date from various fields
  const parseDateFromRecord = (record: any, fieldNames: string[]): Date | null => {
    // First, check if there's an originalDoc field that preserves original field names
    const originalDoc = record.originalDoc || record.original_doc || record
    
    for (const fieldName of fieldNames) {
      // Try multiple variations of the field name
      // Check both original format and normalized format (snake_case, lowercase)
      const variations = [
        fieldName, // Original: "AWB Assigned Date"
        fieldName.replace(/\s+/g, '__'), // "AWB__Assigned__Date"
        fieldName.replace(/\s+/g, '_'), // "AWB_Assigned_Date"
        fieldName.toLowerCase().replace(/\s+/g, '_'), // "awb_assigned_date" (normalized)
        fieldName.toLowerCase().replace(/\s+/g, '__'), // "awb__assigned__date"
        fieldName.toLowerCase(), // "awb assigned date"
        fieldName.toUpperCase().replace(/\s+/g, '_'), // "AWB_ASSIGNED_DATE"
        // Also try with special characters removed (as normalizeKeys does)
        fieldName.replace(/[^a-z0-9_]/gi, '').toLowerCase().replace(/\s+/g, '_'), // "awbassigneddate" -> "awb_assigned_date"
      ]
      
      // Check both the record and originalDoc
      const sources = [record, originalDoc]
      
      for (const source of sources) {
        for (const variation of variations) {
          // Check both direct access and bracket notation
          const value = source[variation] || source[fieldName]
          if (value && value !== 'N/A' && value !== "'" && value !== 'none' && value !== null && value !== '' && value !== undefined) {
            try {
              const date = new Date(value)
              if (!isNaN(date.getTime())) {
                return date
              }
            } catch (e) {
              // Continue to next variation
            }
          }
        }
      }
    }
    return null
  }

  // Aggregate average order TAT by time period
  const aggregateAverageOrderTatByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const tatMetricsMap = new Map<string, Map<string, { sum: number; count: number }>>()
    const timePeriodOrderCounts = new Map<string, number>()

    // Initialize metric names
    const metricNames = [
      'Order Placed to Pickup TAT',
      'Order Placed - Approval TAT',
      'Approval to AWB TAT',
      'AWB to Pickup TAT',
      'Pickup OFD TAT',
      'Order Placed to OFD TAT',
      'Approved Orders',
    ]

    records.forEach((record: any) => {
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Count orders per time period
      const currentCount = timePeriodOrderCounts.get(timeKey) || 0
      timePeriodOrderCounts.set(timeKey, currentCount + 1)

      // Parse dates
      const orderDate = parseDateFromRecord(record, [
        'Shiprocket Created At', 'shiprocket__created__at', 'order_date', 'order__date', 'Order Date', 'Channel Created At', 'channel__created__at'
      ])
      
      // For approval date, check if there's an explicit approval date field
      // If not found, assume approval happens immediately (same as order date, making TAT = 0)
      const approvalDateField = parseDateFromRecord(record, [
        'Approval Date', 'approval__date', 'Order Approved Date', 'order__approved__date', 'Approved Date', 'approved__date'
      ])
      const approvalDate = approvalDateField || orderDate // If no explicit approval date, use order date (TAT = 0)
      
      const awbDate = parseDateFromRecord(record, [
        'AWB Assigned Date', 'awb_assigned_date', 'awb__assigned__date', 'AWB Assigned Date', 'awbassigneddate'
      ])
      
      const pickupDate = parseDateFromRecord(record, [
        'Order Picked Up Date', 'order__picked__up__date', 'Pickedup Timestamp', 'pickedup__timestamp', 'pickup_date', 'Order Picked Up Date'
      ])
      
      const ofdDate = parseDateFromRecord(record, [
        'First Out For Delivery Date', 'first__out__for__delivery__date', 'Latest OFD Date', 'latest__o_f_d__date', 'ofd_date', 'Latest OFD Date'
      ])

      // Calculate TATs (in days)
      // Only calculate if both dates exist and are valid
      const orderToPickupTat = orderDate && pickupDate ? convertTatToDays((pickupDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60)) : null
      
      // Order Placed - Approval TAT: 
      // If there's an explicit approval date field, calculate the TAT
      // If no explicit approval date field but orderDate exists, approval happens immediately (TAT = 0)
      // Only show 0 if orderDate exists (meaning we can calculate it)
      const orderToApprovalTat = orderDate 
        ? (approvalDateField 
            ? convertTatToDays((approvalDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60))
            : 0) // No explicit approval date = immediate approval = 0 days
        : null
      
      // Approval to AWB TAT: Only calculate if both approval date and AWB date exist
      const approvalToAwbTat = approvalDate && awbDate && approvalDateField 
        ? convertTatToDays((awbDate.getTime() - approvalDate.getTime()) / (1000 * 60 * 60)) 
        : null
      
      // AWB to Pickup TAT: Only calculate if both AWB date and pickup date exist
      const awbToPickupTat = awbDate && pickupDate 
        ? convertTatToDays((pickupDate.getTime() - awbDate.getTime()) / (1000 * 60 * 60)) 
        : null
      
      const pickupToOfdTat = pickupDate && ofdDate 
        ? convertTatToDays((ofdDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60)) 
        : null
      
      const orderToOfdTat = orderDate && ofdDate 
        ? convertTatToDays((ofdDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60)) 
        : null

      // Initialize metrics map
      metricNames.forEach((metricName) => {
        if (!tatMetricsMap.has(metricName)) {
          tatMetricsMap.set(metricName, new Map())
        }
        const metricMap = tatMetricsMap.get(metricName)!
        if (!metricMap.has(timeKey)) {
          metricMap.set(timeKey, { sum: 0, count: 0 })
        }
      })

      // Add TAT values
      const metrics = tatMetricsMap.get('Order Placed to Pickup TAT')!
      if (orderToPickupTat !== null) {
        const data = metrics.get(timeKey)!
        data.sum += orderToPickupTat
        data.count++
      }

      const approvalMetrics = tatMetricsMap.get('Order Placed - Approval TAT')!
      if (orderToApprovalTat !== null) {
        const data = approvalMetrics.get(timeKey)!
        data.sum += orderToApprovalTat
        data.count++
      }

      const approvalToAwbMetrics = tatMetricsMap.get('Approval to AWB TAT')!
      if (approvalToAwbTat !== null) {
        const data = approvalToAwbMetrics.get(timeKey)!
        data.sum += approvalToAwbTat
        data.count++
      }

      const awbToPickupMetrics = tatMetricsMap.get('AWB to Pickup TAT')!
      if (awbToPickupTat !== null) {
        const data = awbToPickupMetrics.get(timeKey)!
        data.sum += awbToPickupTat
        data.count++
      }

      const pickupToOfdMetrics = tatMetricsMap.get('Pickup OFD TAT')!
      if (pickupToOfdTat !== null) {
        const data = pickupToOfdMetrics.get(timeKey)!
        data.sum += pickupToOfdTat
        data.count++
      }

      const orderToOfdMetrics = tatMetricsMap.get('Order Placed to OFD TAT')!
      if (orderToOfdTat !== null) {
        const data = orderToOfdMetrics.get(timeKey)!
        data.sum += orderToOfdTat
        data.count++
      }

      // Approved Orders count (all orders are considered approved)
      const approvedOrdersMetrics = tatMetricsMap.get('Approved Orders')!
      const approvedData = approvedOrdersMetrics.get(timeKey)!
      approvedData.sum += 1
      approvedData.count += 1
    })

    // Convert to array format
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    tatMetricsMap.forEach((metricMap) => {
      metricMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a)) // Newest first

    metricNames.forEach((metricName) => {
      const metricMap = tatMetricsMap.get(metricName)!
      const timePeriods: any[] = []

      if (view === 'overall') {
        const overallData = metricMap.get('overall') || { sum: 0, count: 0 }
        let value: number | null = null
        if (metricName === 'Approved Orders') {
          value = overallData.sum
        } else {
          value = overallData.count > 0 ? overallData.sum / overallData.count : null
        }
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          value: value,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = metricMap.get(timeKey) || { sum: 0, count: 0 }
          let value: number | null = null
          if (metricName === 'Approved Orders') {
            value = data.sum
          } else {
            value = data.count > 0 ? data.sum / data.count : null
          }

          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            value: value,
          })
        })
      }

      result.push({
        metric: metricName,
        timePeriods: timePeriods,
      })
    })

    return result
  }

  // Prepare average order TAT data based on view
  // Use API data for overall view, local computation for day/week views
  const averageOrderTatDataByView = useMemo(() => {
    if (averageOrderTatTableView === 'overall' && averageOrderTatData.length > 0) {
      // API data is already in the right format
      return averageOrderTatData
    } else if (rawShippingData.length > 0) {
      return aggregateAverageOrderTatByTime(rawShippingData, averageOrderTatTableView)
    }
    return []
  }, [averageOrderTatTableView, averageOrderTatData, rawShippingData])
  
  // Get all unique time periods for column headers
  const averageOrderTatTimePeriods = averageOrderTatDataByView.length > 0 && averageOrderTatTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        averageOrderTatDataByView.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  const averageOrderTatShowTime = averageOrderTatTableView === 'day' || averageOrderTatTableView === 'week'

  // Aggregate FAD/DEL/CAN/RTO % by time period
  const aggregateFadDelCanRtoByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const metricsMap = new Map<string, Map<string, { count: number }>>()
    const timePeriodOrderCounts = new Map<string, number>()

    // Initialize metric names
    const metricNames = [
      'FAD%',
      'Del%',
      'OFD%',
      'NDR%',
      'Intransit%',
      'RTO%',
      'Canceled%',
      'RVP%',
    ]

    records.forEach((record: any) => {
      // Get time key
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Count orders per time period
      const currentCount = timePeriodOrderCounts.get(timeKey) || 0
      timePeriodOrderCounts.set(timeKey, currentCount + 1)

      // Initialize metrics map
      metricNames.forEach((metricName) => {
        if (!metricsMap.has(metricName)) {
          metricsMap.set(metricName, new Map())
        }
        const metricMap = metricsMap.get(metricName)!
        if (!metricMap.has(timeKey)) {
          metricMap.set(timeKey, { count: 0 })
        }
      })

      // Get status
      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        ''
      ).toUpperCase().trim()

      // Categorize status
      const isDelivered = status === 'DELIVERED' || status === 'DEL'
      const isFad = isDelivered && !record.ndr_flag
      const isOfd = status === 'OFD' || status === 'OUT FOR DELIVERY'
      const isNdr = record.ndr_flag || status === 'NDR' || status.includes('NDR')
      const isRto = status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
                    status === 'RTO IN TRANSIT' || status === 'RTO NDR' || status.includes('RTO')
      const isCanceled = status === 'CANCELED' || status === 'CANCELLED' || status === 'CANCEL' ||
                        record.cancelled_flag || status.includes('CANCEL')
      const isRvp = status === 'RVP' || status.includes('RVP')
      const isInTransit = (status.includes('IN TRANSIT') || status.includes('PICKED UP') || 
                          status.includes('REACHED DESTINATION') || status.includes('AT DESTINATION')) &&
                          !isDelivered && !isRto && !isCanceled

      // Count metrics
      if (isFad) {
        const data = metricsMap.get('FAD%')!.get(timeKey)!
        data.count++
      }
      if (isDelivered) {
        const data = metricsMap.get('Del%')!.get(timeKey)!
        data.count++
      }
      if (isOfd) {
        const data = metricsMap.get('OFD%')!.get(timeKey)!
        data.count++
      }
      if (isNdr) {
        const data = metricsMap.get('NDR%')!.get(timeKey)!
        data.count++
      }
      if (isInTransit) {
        const data = metricsMap.get('Intransit%')!.get(timeKey)!
        data.count++
      }
      if (isRto) {
        const data = metricsMap.get('RTO%')!.get(timeKey)!
        data.count++
      }
      if (isCanceled) {
        const data = metricsMap.get('Canceled%')!.get(timeKey)!
        data.count++
      }
      if (isRvp) {
        const data = metricsMap.get('RVP%')!.get(timeKey)!
        data.count++
      }
    })

    // Convert to array format and calculate percentages
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    metricsMap.forEach((metricMap) => {
      metricMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))

    metricNames.forEach((metricName) => {
      const metricMap = metricsMap.get(metricName)!
      const timePeriods: any[] = []

      if (view === 'overall') {
        const overallData = metricMap.get('overall') || { count: 0 }
        const total = timePeriodOrderCounts.get('overall') || records.length
        const percent = total > 0 ? (overallData.count / total) * 100 : 0
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          percent: percent,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = metricMap.get(timeKey) || { count: 0 }
          const total = timePeriodOrderCounts.get(timeKey) || 0
          const percent = total > 0 ? (data.count / total) * 100 : 0

          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            percent: percent,
          })
        })
      }

      result.push({
        metric: metricName,
        timePeriods: timePeriods,
      })
    })

    return result
  }

  // Aggregate cancellation reason tracker by time period
  const aggregateCancellationReasonTrackerByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const cancellationMap = new Map<string, Map<string, number>>()
    const timePeriodOrderCounts = new Map<string, number>()

    records.forEach((record: any) => {
      // Get time key
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Count orders per time period
      const currentCount = timePeriodOrderCounts.get(timeKey) || 0
      timePeriodOrderCounts.set(timeKey, currentCount + 1)

      // Get cancellation reason/bucket
      const cancellationReason = record.cancellation__reason || 
                                 record.cancellation_reason ||
                                 record['Cancellation Reason'] ||
                                 record['Cancellation_Bucket'] ||
                                 (record.cancelled_flag ? 'Canceled' : 'Not Canceled')
      
      // Normalize cancellation reason
      const normalizedReason = cancellationReason === 'Not Canceled' || !record.cancelled_flag
        ? 'Not Canceled'
        : cancellationReason

      // Initialize cancellation map
      if (!cancellationMap.has(normalizedReason)) {
        cancellationMap.set(normalizedReason, new Map())
      }

      const reasonMap = cancellationMap.get(normalizedReason)!
      if (!reasonMap.has(timeKey)) {
        reasonMap.set(timeKey, 0)
      }

      const count = reasonMap.get(timeKey)!
      reasonMap.set(timeKey, count + 1)
    })

    // Convert to array format and calculate percentages
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    cancellationMap.forEach((reasonMap) => {
      reasonMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))

    // Get all cancellation reasons, ensuring "Not Canceled" is first
    const allReasons = Array.from(cancellationMap.keys())
    const sortedReasons = [
      ...allReasons.filter(r => r === 'Not Canceled'),
      ...allReasons.filter(r => r !== 'Not Canceled').sort()
    ]

    sortedReasons.forEach((reason) => {
      const reasonMap = cancellationMap.get(reason)!
      const timePeriods: any[] = []

      if (view === 'overall') {
        const overallCount = reasonMap.get('overall') || 0
        const total = timePeriodOrderCounts.get('overall') || records.length
        const percent = total > 0 ? (overallCount / total) * 100 : 0
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          percent: percent,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const count = reasonMap.get(timeKey) || 0
          const total = timePeriodOrderCounts.get(timeKey) || 0
          const percent = total > 0 ? (count / total) * 100 : 0

          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            percent: percent,
          })
        })
      }

      result.push({
        reason: reason,
        timePeriods: timePeriods,
      })
    })

    return result
  }

  // Prepare FAD/DEL/CAN/RTO % data based on view
  // Use API data for overall view, local computation for day/week views
  const fadDelCanRtoDataByView = useMemo(() => {
    if (fadDelCanRtoTableView === 'overall' && fadDelCanRtoData.length > 0) {
      // Transform API data to match expected format
      return fadDelCanRtoData.map((item: any) => ({
        metric: item.metric,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          percent: item.percent,
        }],
      }))
    } else if (rawShippingData.length > 0) {
      return aggregateFadDelCanRtoByTime(rawShippingData, fadDelCanRtoTableView)
    }
    return []
  }, [fadDelCanRtoTableView, fadDelCanRtoData, rawShippingData])
  
  // Get all unique time periods for FAD/DEL/CAN/RTO %
  const fadDelCanRtoTimePeriods = fadDelCanRtoDataByView.length > 0 && fadDelCanRtoTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        fadDelCanRtoDataByView.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a))
      })()
    : []
  
  const fadDelCanRtoShowTime = fadDelCanRtoTableView === 'day' || fadDelCanRtoTableView === 'week'

  // Prepare cancellation reason tracker data based on view
  // Use API data for overall view, local computation for day/week views
  const cancellationReasonTrackerDataByView = useMemo(() => {
    if (cancellationReasonTrackerTableView === 'overall' && cancellationReasonTrackerData.length > 0) {
      // Transform API data to match expected format
      return cancellationReasonTrackerData.map((item: any) => ({
        reason: item.reason,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          percent: item.percent,
        }],
      }))
    } else if (rawShippingData.length > 0) {
      return aggregateCancellationReasonTrackerByTime(rawShippingData, cancellationReasonTrackerTableView)
    }
    return []
  }, [cancellationReasonTrackerTableView, cancellationReasonTrackerData, rawShippingData])
  
  // Get all unique time periods for cancellation reason tracker
  const cancellationReasonTrackerTimePeriods = cancellationReasonTrackerDataByView.length > 0 && cancellationReasonTrackerTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        cancellationReasonTrackerDataByView.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a))
      })()
    : []
  
  const cancellationReasonTrackerShowTime = cancellationReasonTrackerTableView === 'day' || cancellationReasonTrackerTableView === 'week'

  // Aggregate delivery partner analysis by state, courier, and time period
  const aggregateDeliveryPartnerAnalysisByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const partnerMap = new Map<string, Map<string, any>>() // Map<"state:courier", Map<timeKey, metrics>>

    records.forEach((record: any) => {
      const state = record.state || record.address__state || record['Address State'] || 'Unknown'
      const courier = record['Courier Company'] || 
                     record.courier_company || 
                     record.courier__company ||
                     record['Master Courier'] ||
                     record.master_courier ||
                     'Unknown'
      
      const partnerKey = `${state}:${courier}`
      
      // Get time key (day, week, or 'overall' for aggregated view)
      let timeKey: string = 'overall'
      if (view === 'day') {
        let orderDateValue: any = null
        if (record.order_date) {
          orderDateValue = record.order_date
        } else if (record.order__date) {
          orderDateValue = record.order__date
        } else if (record['Order Date']) {
          orderDateValue = record['Order Date']
        } else if (record['Shiprocket Created At']) {
          orderDateValue = record['Shiprocket Created At']
        } else if (record.shiprocket__created__at) {
          orderDateValue = record.shiprocket__created__at
        } else if (record.channel__created__at) {
          orderDateValue = record.channel__created__at
        }
        
        if (orderDateValue) {
          if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            timeKey = orderDateValue
          } else {
            try {
              const date = new Date(orderDateValue)
              if (!isNaN(date.getTime())) {
                timeKey = date.toISOString().split('T')[0]
              }
            } catch (e) {
              // Keep overall
            }
          }
        }
      } else if (view === 'week') {
        timeKey = record.order_week || 'overall'
      }

      // Initialize partner map if not exists
      if (!partnerMap.has(partnerKey)) {
        partnerMap.set(partnerKey, new Map())
      }

      const timeMap = partnerMap.get(partnerKey)!
      
      // Initialize time period if not exists
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          total_orders: 0,
          delivered: 0,
          cancelled: 0,
          in_transit: 0,
          rto: 0,
          other: 0,
        })
      }

      const timeData = timeMap.get(timeKey)!
      timeData.total_orders++

      // Get status
      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        ''
      ).toUpperCase().trim()

      // Categorize status
      const isDelivered = status === 'DELIVERED' || status === 'DEL'
      const isRto = status === 'RTO' || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || 
                    status === 'RTO IN TRANSIT' || status === 'RTO NDR' || status.includes('RTO')
      const isCanceled = status === 'CANCELED' || status === 'CANCELLED' || status === 'CANCEL' ||
                        record.cancelled_flag || status.includes('CANCEL')
      const isInTransit = (status.includes('IN TRANSIT') || status.includes('PICKED UP') || 
                          status.includes('REACHED DESTINATION') || status.includes('AT DESTINATION') ||
                          status === 'OFD' || status === 'OUT FOR DELIVERY' ||
                          status.includes('SHIPPED')) &&
                          !isDelivered && !isRto && !isCanceled

      if (isDelivered) {
        timeData.delivered++
      } else if (isCanceled) {
        timeData.cancelled++
      } else if (isInTransit) {
        timeData.in_transit++
      } else if (isRto) {
        timeData.rto++
      } else {
        timeData.other++
      }
    })

    // Convert to array format: [{ state, courier, timePeriods: [{ timeKey, delivered, cancelled, in_transit, rto, other, total_orders }] }]
    const result: any[] = []
    const allTimePeriods = new Set<string>()
    
    partnerMap.forEach((timeMap) => {
      timeMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))
    
    partnerMap.forEach((timeMap, partnerKey) => {
      const [state, courier] = partnerKey.split(':')
      const timePeriods: any[] = []
      
      if (view === 'overall') {
        const overallData = timeMap.get('overall') || { total_orders: 0, delivered: 0, cancelled: 0, in_transit: 0, rto: 0, other: 0 }
        
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          delivered: overallData.delivered,
          cancelled: overallData.cancelled,
          in_transit: overallData.in_transit,
          rto: overallData.rto,
          other: overallData.other,
          total_orders: overallData.total_orders,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = timeMap.get(timeKey) || { total_orders: 0, delivered: 0, cancelled: 0, in_transit: 0, rto: 0, other: 0 }
          
          let formattedTime = timeKey
          if (view === 'day') {
            try {
              const dateObj = new Date(timeKey)
              if (!isNaN(dateObj.getTime())) {
                const day = dateObj.getDate()
                const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                const year = dateObj.getFullYear()
                formattedTime = `${day} ${month} ${year}`
              }
            } catch (e) {
              // Keep original
            }
          } else if (view === 'week') {
            formattedTime = formatDate(timeKey, false)
          }
          
          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            delivered: data.delivered,
            cancelled: data.cancelled,
            in_transit: data.in_transit,
            rto: data.rto,
            other: data.other,
            total_orders: data.total_orders,
          })
        })
      }
      
      result.push({
        state: state,
        courier: courier,
        timePeriods: timePeriods,
      })
    })

    // Sort by total orders (descending) - sum across all time periods
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Prepare delivery partner analysis data based on view
  // Use API data for overall view, local computation for day/week views
  const deliveryPartnerAnalysisDataByView = useMemo(() => {
    if (deliveryPartnerAnalysisTableView === 'overall' && deliveryPartnerAnalysisData.length > 0) {
      // Transform API data to match expected format
      return deliveryPartnerAnalysisData.map((item: any) => ({
        state: item.state,
        courier: item.courier,
        timePeriods: [{
          time: null,
          timeKey: 'overall',
          delivered: item.delivered,
          cancelled: item.cancelled,
          in_transit: item.in_transit,
          rto: item.rto,
          other: item.other,
          total_orders: item.total_orders,
        }],
      }))
    } else if (rawShippingData.length > 0) {
      return aggregateDeliveryPartnerAnalysisByTime(rawShippingData, deliveryPartnerAnalysisTableView)
    }
    return []
  }, [deliveryPartnerAnalysisTableView, deliveryPartnerAnalysisData, rawShippingData])
  
  // Filter delivery partner analysis data by selected courier
  const filteredDeliveryPartnerAnalysisData = useMemo(() => {
    if (selectedDeliveryPartner === 'All') {
      return deliveryPartnerAnalysisDataByView
    }
    return deliveryPartnerAnalysisDataByView.filter((item: any) => item.courier === selectedDeliveryPartner)
  }, [deliveryPartnerAnalysisDataByView, selectedDeliveryPartner])

  // Get all unique time periods for column headers (from filtered data)
  const deliveryPartnerAnalysisTimePeriods = filteredDeliveryPartnerAnalysisData.length > 0 && deliveryPartnerAnalysisTableView !== 'overall'
    ? (() => {
        const timeSet = new Set<string>()
        filteredDeliveryPartnerAnalysisData.forEach((item) => {
          item.timePeriods.forEach((tp: any) => {
            if (tp.timeKey && tp.timeKey !== 'overall') {
              timeSet.add(tp.timeKey)
            }
          })
        })
        return Array.from(timeSet).sort((a, b) => b.localeCompare(a)) // Newest first
      })()
    : []
  
  const deliveryPartnerAnalysisShowTime = deliveryPartnerAnalysisTableView === 'day' || deliveryPartnerAnalysisTableView === 'week'

  // Get unique courier companies for delivery partner filter
  const availableCouriers = useMemo(() => {
    const courierSet = new Set<string>()
    rawShippingData.forEach((record: any) => {
      const courier = record['Courier Company'] || 
                     record.courier_company || 
                     record.courier__company ||
                     record['Master Courier'] ||
                     record.master_courier ||
                     null
      if (courier && courier !== 'none' && courier !== 'N/A' && courier !== '') {
        courierSet.add(String(courier))
      }
    })
    return Array.from(courierSet).sort()
  }, [rawShippingData])

  // Payment mode data from filtered analytics
  const paymentModeData = paymentMethodData.length > 0 
    ? paymentMethodData.map((item: any) => ({
        name: item.name || 'Unknown',
        value: item.value || 0,
        count: item.count || 0,
      }))
    : []

  // Status grouping function - maps raw statuses to business categories
  const getStatusCategory = (status: string): string => {
    const upperStatus = status.toUpperCase().trim()
    
    // Delivered
    if (upperStatus === 'DELIVERED') return 'Delivered'
    
    // In Transit
    if (
      upperStatus.includes('IN TRANSIT') ||
      upperStatus.includes('OUT FOR DELIVERY') ||
      upperStatus.includes('OUT FOR PICKUP') ||
      upperStatus.includes('PICKED UP') ||
      upperStatus.includes('REACHED DESTINATION HUB') ||
      upperStatus.includes('AT DESTINATION HUB')
    ) return 'In Transit'
    
    // RTO Flow
    if (
      upperStatus.includes('RTO') ||
      upperStatus === 'RTO INITIATED' ||
      upperStatus === 'RTO IN TRANSIT' ||
      upperStatus === 'RTO NDR' ||
      upperStatus === 'RTO DELIVERED'
    ) return 'RTO Flow'
    
    // Undelivered Attempts
    if (
      upperStatus.includes('UNDELIVERED') ||
      upperStatus.includes('NDR')
    ) return 'Undelivered Attempts'
    
    // Canceled / Lost
    if (
      upperStatus === 'CANCELED' ||
      upperStatus === 'CANCELLED' ||
      upperStatus === 'LOST' ||
      upperStatus === 'DESTROYED' ||
      upperStatus === 'UNTRACEABLE'
    ) return 'Canceled / Lost'
    
    // Exceptions
    if (
      upperStatus.includes('EXCEPTION') ||
      upperStatus.includes('REACHED BACK') ||
      upperStatus.includes('SELLER')
    ) return 'Exceptions'
    
    return 'Other'
  }

  // Semantic colors for status categories
  const statusCategoryColors: { [key: string]: string } = {
    'Delivered': '#10b981', // Green
    'In Transit': '#3b82f6', // Blue
    'RTO Flow': '#f97316', // Orange
    'Undelivered Attempts': '#ef4444', // Red
    'Canceled / Lost': '#6b7280', // Gray
    'Exceptions': '#eab308', // Yellow
    'Other': '#8b5cf6', // Purple
  }

  // Chart 1: Order Lifecycle Funnel Data (Grouped statuses)
  const lifecycleData = Array.isArray(orderStatusesData) && orderStatusesData.length > 0
    ? (() => {
        const categoryMap = new Map<string, number>()
        orderStatusesData.forEach((item: any) => {
          const category = getStatusCategory(item.status || 'UNKNOWN')
          const currentCount = categoryMap.get(category) || 0
          categoryMap.set(category, currentCount + (item.count || 0))
        })
        
        const total = Array.from(categoryMap.values()).reduce((sum, count) => sum + count, 0)
        
        return Array.from(categoryMap.entries())
          .map(([category, count]) => ({
            category,
            count,
            percent: total > 0 ? (count / total) * 100 : 0,
            color: statusCategoryColors[category] || '#8b5cf6',
          }))
          .sort((a, b) => {
            // Order: Delivered -> In Transit -> RTO Flow -> Undelivered -> Canceled -> Exceptions -> Other
            const order: { [key: string]: number } = {
              'Delivered': 1,
              'In Transit': 2,
              'RTO Flow': 3,
              'Undelivered Attempts': 4,
              'Canceled / Lost': 5,
              'Exceptions': 6,
              'Other': 7,
            }
            return (order[a.category] || 99) - (order[b.category] || 99)
          })
      })()
    : []

  // Chart 2: Payment Method vs Final Outcome (100% Stacked Bar)
  // Use real data from API (already fetched and set in state)
  // The data structure is: [{ paymentMethod: string, total: number, Delivered: number, ... }, ...]
  // where each category is a percentage

  // Chart 3: Operational Status Breakdown (Top 8 statuses by volume)
  const operationalStatusData = Array.isArray(orderStatusesData) && orderStatusesData.length > 0
    ? orderStatusesData
        .map((item: any) => ({
          status: item.status || 'UNKNOWN',
          count: item.count || 0,
          percent: item.percent || 0,
          category: getStatusCategory(item.status || 'UNKNOWN'),
          color: statusCategoryColors[getStatusCategory(item.status || 'UNKNOWN')] || '#8b5cf6',
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    : []

  // Calculate KPIs
  const totalOrders = summaryMetrics.syncedOrders || (Array.isArray(orderStatusesData) ? orderStatusesData.reduce((sum: number, item: any) => sum + (item.count || 0), 0) : 0)
  const deliveredCount = lifecycleData.find(item => item.category === 'Delivered')?.count || 0
  const rtoCount = lifecycleData.find(item => item.category === 'RTO Flow')?.count || 0
  const canceledCount = lifecycleData.find(item => item.category === 'Canceled / Lost')?.count || 0
  const inTransitCount = lifecycleData.find(item => item.category === 'In Transit')?.count || 0
  
  const deliveryRate = totalOrders > 0 ? (deliveredCount / totalOrders) * 100 : 0
  const rtoRate = totalOrders > 0 ? (rtoCount / totalOrders) * 100 : 0
  
  // Net Delivery Rate (delivered / (delivered + RTO + canceled))
  const netDeliveryRate = (deliveredCount + rtoCount + canceledCount) > 0 
    ? (deliveredCount / (deliveredCount + rtoCount + canceledCount)) * 100 
    : 0
  
  // Benchmark comparison (assuming 60% as benchmark - can be made configurable)
  const deliveryBenchmark = 60.0
  const rtoTarget = 30.0
  const netDeliveryVsBenchmark = netDeliveryRate - deliveryBenchmark
  const rtoVsTarget = rtoRate - rtoTarget
  
  // GMV at Risk (RTO orders × avg order value)
  const gmv = summaryMetrics.gmv || 0
  const avgOrderValue = totalOrders > 0 ? gmv / totalOrders : 0
  const gmvAtRisk = rtoCount * avgOrderValue
  const gmvAtRiskPercent = gmv > 0 ? (gmvAtRisk / gmv) * 100 : 0
  
  // COD vs Online actionable metrics
  let codDeliveryRate = 0
  let codRtoRate = 0
  let onlineDeliveryRate = 0
  let onlineRtoRate = 0
  
  if (paymentMethodOutcomeData.length > 0) {
    const codOutcome = paymentMethodOutcomeData.find((p: any) => 
      p.paymentMethod?.toUpperCase().includes('COD') || 
      p.paymentMethod?.toUpperCase().includes('CASH')
    )
    const onlineOutcome = paymentMethodOutcomeData.find((p: any) => 
      p.paymentMethod?.toUpperCase().includes('ONLINE') || 
      p.paymentMethod?.toUpperCase().includes('PREPAID')
    )
    
    if (codOutcome) {
      codDeliveryRate = codOutcome.Delivered || 0
      codRtoRate = codOutcome['RTO Flow'] || 0
    }
    if (onlineOutcome) {
      onlineDeliveryRate = onlineOutcome.Delivered || 0
      onlineRtoRate = onlineOutcome['RTO Flow'] || 0
    }
  }
  
  const codPenalty = codDeliveryRate - onlineDeliveryRate

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 overflow-y-auto">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-lg border-b border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => router.push('/admin')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </motion.button>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold text-white whitespace-nowrap"
            >
              Dropship Analytics Dashboard
            </motion.h1>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-col lg:flex-row">
        {/* Left Sidebar - Filters */}
        <aside className="w-full lg:w-80 xl:w-96 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto z-10">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>
            <AnalyticsFilters
              onFilterChange={setFilters}
              availableChannels={availableChannels}
              availableSkus={availableSkus}
              availableSkusTop10={availableSkusTop10}
              availableProductNames={availableProductNames}
              availableProductNamesTop10={availableProductNamesTop10}
              availableStatuses={availableStatuses}
              sessionId={sessionId}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {loadingData ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading analytics data...</div>
          </div>
        ) : dataError ? (
          <div className="text-center py-12">
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-yellow-400 font-semibold mb-2">Data Expired</p>
              <p className="text-gray-400 text-sm mb-4">{dataError}</p>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Go to Admin Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {/* Synced Orders Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500"
              >
                <h3 className="text-gray-600 text-sm font-medium mb-2">Synced Orders</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summaryMetrics.syncedOrders.toLocaleString('en-IN')}
                </p>
              </motion.div>

              {/* GMV Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500"
              >
                <h3 className="text-gray-600 text-sm font-medium mb-2">GMV</h3>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{summaryMetrics.gmv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500 mt-2">Margin Applied: 0.00%</p>
              </motion.div>

              {/* In Transit % Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500"
              >
                <h3 className="text-gray-600 text-sm font-medium mb-2">In Transit %</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summaryMetrics.inTransitPercent.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-2">Orders: {summaryMetrics.inTransitOrders.toLocaleString('en-IN')}</p>
              </motion.div>

              {/* Delivery % Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500"
              >
                <h3 className="text-gray-600 text-sm font-medium mb-2">Delivery %</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summaryMetrics.deliveryPercent.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-2">Delivered: {summaryMetrics.deliveredOrders.toLocaleString('en-IN')}</p>
              </motion.div>

              {/* RTO % Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500"
              >
                <h3 className="text-gray-600 text-sm font-medium mb-2">RTO %</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {summaryMetrics.rtoPercent.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-2">RTO: {summaryMetrics.rtoOrders.toLocaleString('en-IN')}</p>
              </motion.div>
            </div>

            {/* Delivery Performance Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsDeliveryPerformanceVisible(!isDeliveryPerformanceVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isDeliveryPerformanceVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isDeliveryPerformanceVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                <h3 className="text-xl font-bold text-white">Delivery Performance</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                  </div>
                </div>
              {isDeliveryPerformanceVisible && dailyDeliveryPerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[320px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800">Date</th>
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 text-right bg-gray-800">Orders</th>
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 text-right bg-gray-800">Order Share %</th>
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 text-right bg-gray-800">Delivered %</th>
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 text-right bg-gray-800">RTO %</th>
                          <th className="pb-3 text-sm font-semibold text-gray-300 text-right bg-gray-800">GMV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyDeliveryPerformance.map((day, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="py-3 pr-6 text-white font-medium">{day.date}</td>
                            <td className="py-3 pr-6 text-white text-right">{day.orders.toLocaleString('en-IN')}</td>
                            <td className="py-3 pr-6 text-white text-right">{day.orderShare.toFixed(2)}%</td>
                            <td className="py-3 pr-6 text-white text-right">{day.deliveredPercent.toFixed(2)}%</td>
                            <td className="py-3 pr-6 text-white text-right">{day.rtoPercent.toFixed(2)}%</td>
                            <td className="py-3 text-white text-right">₹{day.gmv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isDeliveryPerformanceVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {loadingData
                    ? 'Loading data...'
                    : (tableView === 'day' && rawShippingData.length === 0)
                      ? 'No daily data available'
                      : (tableView === 'week' && weeklySummary.length === 0)
                        ? 'No weekly data available'
                        : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Products Analysis Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsProductsAnalysisVisible(!isProductsAnalysisVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isProductsAnalysisVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isProductsAnalysisVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Products Analysis</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProductsTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        productsTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setProductsTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        productsTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setProductsTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        productsTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isProductsAnalysisVisible && productsDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">Product Name</th>
                          {productsShowTime && productsTimePeriods.length > 0 ? (
                            productsTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (productsTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (productsTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} colSpan={6} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th colSpan={6} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20"></th>
                          {productsShowTime && productsTimePeriods.length > 0 ? (
                            productsTimePeriods.map((timeKey) => (
                              <React.Fragment key={timeKey}>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Orders</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">GMV</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Del %</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO %</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Margin</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Return %</th>
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Orders</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">GMV</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Del %</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO %</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Margin</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Return %</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {productsDataByView.map((item, index) => {
                          const overallData = productsTableView === 'overall'
                            ? item.timePeriods?.[0]
                            : null
                          
                          return (
                            <tr 
                              key={index} 
                              className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.product_name}</td>
                              {productsShowTime && productsTimePeriods.length > 0 ? (
                                productsTimePeriods.map((timeKey) => {
                                  const timeData = item.timePeriods?.find((tp: any) => tp.timeKey === timeKey)
                                  return (
                                    <React.Fragment key={timeKey}>
                                      <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                        {timeData ? timeData.orders.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? `₹${timeData.gmv.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.deliveredPercent.toFixed(2) + '%' : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.rtoPercent.toFixed(2) + '%' : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? `₹${timeData.margin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.returnedPercent.toFixed(2) + '%' : '-'}
                                      </td>
                                    </React.Fragment>
                                  )
                                })
                              ) : (
                                <>
                                  <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {overallData ? overallData.orders.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? `₹${overallData.gmv.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.deliveredPercent.toFixed(2) + '%' : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.rtoPercent.toFixed(2) + '%' : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? `₹${overallData.margin.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.returnedPercent.toFixed(2) + '%' : '-'}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isProductsAnalysisVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {productsTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Delivery by State Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsDeliveryByStateVisible(!isDeliveryByStateVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isDeliveryByStateVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isDeliveryByStateVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Delivery by State</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStateTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        stateTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setStateTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        stateTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setStateTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        stateTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isDeliveryByStateVisible && statesDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">State</th>
                          {statesShowTime && statesTimePeriods.length > 0 ? (
                            statesTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (stateTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (stateTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} colSpan={6} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th colSpan={6} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20"></th>
                          {statesShowTime && statesTimePeriods.length > 0 ? (
                            statesTimePeriods.map((timeKey) => (
                              <React.Fragment key={timeKey}>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Orders</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Delivered</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Del %</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO %</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Order Share %</th>
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Orders</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Delivered</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Del %</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO %</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Order Share %</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {statesDataByView.map((item, index) => {
                          const overallData = stateTableView === 'overall'
                            ? item.timePeriods?.[0]
                            : null
                          
                          return (
                            <tr 
                              key={index} 
                              className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.state}</td>
                              {statesShowTime && statesTimePeriods.length > 0 ? (
                                statesTimePeriods.map((timeKey) => {
                                  const timeData = item.timePeriods?.find((tp: any) => tp.timeKey === timeKey)
                                  return (
                                    <React.Fragment key={timeKey}>
                                      <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                        {timeData ? timeData.total_orders.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.del_count.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.rto_count.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.delivered_percent.toFixed(2) + '%' : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.rto_percent.toFixed(2) + '%' : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.orderShare.toFixed(2) + '%' : '-'}
                                      </td>
                                    </React.Fragment>
                                  )
                                })
                              ) : (
                                <>
                                  <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {overallData ? overallData.total_orders.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.del_count.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.rto_count.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.delivered_percent.toFixed(2) + '%' : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.rto_percent.toFixed(2) + '%' : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.orderShare.toFixed(2) + '%' : '-'}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isDeliveryByStateVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {stateTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* NDR Count Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsNdrCountVisible(!isNdrCountVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isNdrCountVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isNdrCountVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">NDR Count</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNdrCountTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        ndrCountTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setNdrCountTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        ndrCountTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setNdrCountTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        ndrCountTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isNdrCountVisible && ndrCountDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">NDR Description</th>
                          {ndrCountShowTime && ndrCountTimePeriods.length > 0 ? (
                            ndrCountTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (ndrCountTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (ndrCountTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} colSpan={2} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th colSpan={2} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20"></th>
                          {ndrCountShowTime && ndrCountTimePeriods.length > 0 ? (
                            ndrCountTimePeriods.map((timeKey) => (
                              <React.Fragment key={timeKey}>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Del</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Total</th>
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Del</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Total</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {ndrCountDataByView.map((item, index) => {
                          // For overall view, aggregate all time periods
                          const overallData = ndrCountTableView === 'overall'
                            ? item.timePeriods.reduce((acc: any, tp: any) => ({
                                delivered: acc.delivered + tp.delivered,
                                total: acc.total + tp.total,
                              }), { delivered: 0, total: 0 })
                            : null
                          
                          return (
                            <tr 
                              key={index} 
                              className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.reason}</td>
                              {ndrCountShowTime && ndrCountTimePeriods.length > 0 ? (
                                ndrCountTimePeriods.map((timeKey) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return (
                                    <React.Fragment key={timeKey}>
                                      <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                        {timeData ? timeData.delivered.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.total.toLocaleString('en-IN') : '-'}
                                      </td>
                                    </React.Fragment>
                                  )
                                })
                              ) : (
                                <>
                                  <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {overallData ? overallData.delivered.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.total.toLocaleString('en-IN') : '-'}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        {/* Total Row */}
                        {ndrCountDataByView.length > 0 && (
                          <tr className="border-t-2 border-gray-600 font-semibold">
                            <td className="py-3 pr-6 text-white sticky left-0 bg-gray-800/95">Total</td>
                            {ndrCountShowTime && ndrCountTimePeriods.length > 0 ? (
                              ndrCountTimePeriods.map((timeKey) => {
                                const totalDel = ndrCountDataByView.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.delivered : 0)
                                }, 0)
                                const totalTotal = ndrCountDataByView.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.total : 0)
                                }, 0)
                                return (
                                  <React.Fragment key={timeKey}>
                                    <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                      {totalDel.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 pr-6 text-white text-right">
                                      {totalTotal.toLocaleString('en-IN')}
                                    </td>
                                  </React.Fragment>
                                )
                              })
                            ) : (
                              <>
                                <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                  {ndrCountDataByView.reduce((sum, item) => {
                                    const overall = item.timePeriods.reduce((acc: any, tp: any) => ({
                                      delivered: acc.delivered + tp.delivered,
                                      total: acc.total + tp.total,
                                    }), { delivered: 0, total: 0 })
                                    return sum + overall.delivered
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 pr-6 text-white text-right">
                                  {ndrCountDataByView.reduce((sum, item) => {
                                    const overall = item.timePeriods.reduce((acc: any, tp: any) => ({
                                      delivered: acc.delivered + tp.delivered,
                                      total: acc.total + tp.total,
                                    }), { delivered: 0, total: 0 })
                                    return sum + overall.total
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                              </>
                            )}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isNdrCountVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {ndrCountTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Address Type Share Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsAddressTypeShareVisible(!isAddressTypeShareVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isAddressTypeShareVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isAddressTypeShareVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Address Type Share</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddressTypeShareTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        addressTypeShareTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setAddressTypeShareTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        addressTypeShareTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setAddressTypeShareTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        addressTypeShareTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isAddressTypeShareVisible && addressTypeShareDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">Metric</th>
                          {addressTypeShareShowTime && addressTypeShareTimePeriods.length > 0 ? (
                            addressTypeShareTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (addressTypeShareTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (addressTypeShareTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {addressTypeShareDataByView.map((item, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.addressType}</td>
                            {addressTypeShareShowTime && addressTypeShareTimePeriods.length > 0 ? (
                              addressTypeShareTimePeriods.map((timeKey) => {
                                const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                return (
                                  <td key={timeKey} className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {timeData ? timeData.percent.toFixed(1) + '%' : '-'}
                                  </td>
                                )
                              })
                            ) : (
                              <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                {item.timePeriods.length > 0 ? item.timePeriods[0].percent.toFixed(1) + '%' : '-'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isAddressTypeShareVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {addressTypeShareTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Average Order TAT Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsAverageOrderTatVisible(!isAverageOrderTatVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isAverageOrderTatVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isAverageOrderTatVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Average Order TAT</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAverageOrderTatTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        averageOrderTatTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setAverageOrderTatTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        averageOrderTatTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setAverageOrderTatTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        averageOrderTatTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isAverageOrderTatVisible && averageOrderTatDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">Metric</th>
                          {averageOrderTatShowTime && averageOrderTatTimePeriods.length > 0 ? (
                            averageOrderTatTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (averageOrderTatTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (averageOrderTatTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {averageOrderTatDataByView.map((item, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.metric}</td>
                            {averageOrderTatShowTime && averageOrderTatTimePeriods.length > 0 ? (
                              averageOrderTatTimePeriods.map((timeKey) => {
                                const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                const value = timeData?.value
                                return (
                                  <td key={timeKey} className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {value !== null && value !== undefined 
                                      ? (item.metric === 'Approved Orders' 
                                          ? value >= 1000 
                                            ? (value / 1000).toFixed(0) + 'k'
                                            : value.toFixed(0)
                                          : value.toFixed(4).replace(/\.?0+$/, ''))
                                      : '-'}
                                  </td>
                                )
                              })
                            ) : (
                              <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                {item.timePeriods.length > 0 && item.timePeriods[0].value !== null && item.timePeriods[0].value !== undefined
                                  ? (item.metric === 'Approved Orders' 
                                      ? item.timePeriods[0].value >= 1000 
                                        ? (item.timePeriods[0].value / 1000).toFixed(0) + 'k'
                                        : item.timePeriods[0].value.toFixed(0)
                                      : item.timePeriods[0].value.toFixed(4).replace(/\.?0+$/, ''))
                                  : '-'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isAverageOrderTatVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {averageOrderTatTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* FAD/DEL/CAN/RTO % Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsFadDelCanRtoVisible(!isFadDelCanRtoVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isFadDelCanRtoVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isFadDelCanRtoVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">FAD/DEL/CAN/RTO %</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFadDelCanRtoTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        fadDelCanRtoTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setFadDelCanRtoTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        fadDelCanRtoTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setFadDelCanRtoTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        fadDelCanRtoTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isFadDelCanRtoVisible && fadDelCanRtoDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">Metric</th>
                          {fadDelCanRtoShowTime && fadDelCanRtoTimePeriods.length > 0 ? (
                            fadDelCanRtoTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (fadDelCanRtoTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (fadDelCanRtoTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {fadDelCanRtoDataByView.map((item, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.metric}</td>
                            {fadDelCanRtoShowTime && fadDelCanRtoTimePeriods.length > 0 ? (
                              fadDelCanRtoTimePeriods.map((timeKey) => {
                                const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                const percent = timeData?.percent || 0
                                return (
                                  <td key={timeKey} className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {percent.toFixed(1)}%
                                  </td>
                                )
                              })
                            ) : (
                              <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                {item.timePeriods.length > 0 ? item.timePeriods[0].percent.toFixed(1) + '%' : '-'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isFadDelCanRtoVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {fadDelCanRtoTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Cancellation Reason Tracker Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsCancellationReasonTrackerVisible(!isCancellationReasonTrackerVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isCancellationReasonTrackerVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isCancellationReasonTrackerVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Cancellation Reason Tracker</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancellationReasonTrackerTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cancellationReasonTrackerTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setCancellationReasonTrackerTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cancellationReasonTrackerTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setCancellationReasonTrackerTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        cancellationReasonTrackerTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isCancellationReasonTrackerVisible && cancellationReasonTrackerDataByView.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">Cancellation_Bucket</th>
                          {cancellationReasonTrackerShowTime && cancellationReasonTrackerTimePeriods.length > 0 ? (
                            cancellationReasonTrackerTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (cancellationReasonTrackerTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (cancellationReasonTrackerTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {cancellationReasonTrackerDataByView.map((item, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                          >
                            <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">{item.reason}</td>
                            {cancellationReasonTrackerShowTime && cancellationReasonTrackerTimePeriods.length > 0 ? (
                              cancellationReasonTrackerTimePeriods.map((timeKey) => {
                                const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                const percent = timeData?.percent || 0
                                return (
                                  <td key={timeKey} className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {percent > 0 ? percent.toFixed(1) + '%' : ''}
                                  </td>
                                )
                              })
                            ) : (
                              <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                {item.timePeriods.length > 0 && item.timePeriods[0].percent > 0 
                                  ? item.timePeriods[0].percent.toFixed(1) + '%' 
                                  : ''}
                              </td>
                            )}
                          </tr>
                        ))}
                        {/* Total Row */}
                        {cancellationReasonTrackerDataByView.length > 0 && (
                          <tr className="border-t-2 border-gray-600 font-semibold">
                            <td className="py-3 pr-6 text-white sticky left-0 bg-gray-800/95">Total (Sum as Fraction of Columns)</td>
                            {cancellationReasonTrackerShowTime && cancellationReasonTrackerTimePeriods.length > 0 ? (
                              cancellationReasonTrackerTimePeriods.map((timeKey) => {
                                const total = cancellationReasonTrackerDataByView.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData?.percent || 0)
                                }, 0)
                                return (
                                  <td key={timeKey} className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {total.toFixed(1)}%
                                  </td>
                                )
                              })
                            ) : (
                              <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                {cancellationReasonTrackerDataByView.reduce((sum, item) => {
                                  return sum + (item.timePeriods[0]?.percent || 0)
                                }, 0).toFixed(1)}%
                              </td>
                            )}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isCancellationReasonTrackerVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {cancellationReasonTrackerTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>

            {/* Delivery Partner Analysis Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsDeliveryPartnerAnalysisVisible(!isDeliveryPartnerAnalysisVisible)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={isDeliveryPartnerAnalysisVisible ? "Hide" : "Show"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isDeliveryPartnerAnalysisVisible ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      )}
                    </svg>
                  </button>
                  <h3 className="text-xl font-bold text-white">Delivery Partner Analysis</h3>
                </div>
                <div className="flex items-center gap-4">
                  {/* Delivery Partner Filter */}
                  <select
                    value={selectedDeliveryPartner}
                    onChange={(e) => setSelectedDeliveryPartner(e.target.value)}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All Partners</option>
                    {availableCouriers.map((courier) => (
                      <option key={courier} value={courier}>
                        {courier}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeliveryPartnerAnalysisTableView('overall')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        deliveryPartnerAnalysisTableView === 'overall'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setDeliveryPartnerAnalysisTableView('day')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        deliveryPartnerAnalysisTableView === 'day'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setDeliveryPartnerAnalysisTableView('week')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        deliveryPartnerAnalysisTableView === 'week'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                </div>
              </div>
              {isDeliveryPartnerAnalysisVisible && filteredDeliveryPartnerAnalysisData.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="max-h-[600px] overflow-y-auto overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 #1f2937' }}>
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20">State / Courier</th>
                          {deliveryPartnerAnalysisShowTime && deliveryPartnerAnalysisTimePeriods.length > 0 ? (
                            deliveryPartnerAnalysisTimePeriods.map((timeKey) => {
                              let formattedTime = timeKey
                              if (deliveryPartnerAnalysisTableView === 'day') {
                                try {
                                  const dateObj = new Date(timeKey)
                                  if (!isNaN(dateObj.getTime())) {
                                    const day = dateObj.getDate()
                                    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
                                    const year = dateObj.getFullYear()
                                    formattedTime = `${day} ${month} ${year}`
                                  }
                                } catch (e) {
                                  // Keep original
                                }
                              } else if (deliveryPartnerAnalysisTableView === 'week') {
                                formattedTime = formatDate(timeKey, false)
                              }
                              
                              return (
                                <th key={timeKey} colSpan={5} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                                  {formattedTime}
                                </th>
                              )
                            })
                          ) : (
                            <th colSpan={5} className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-center border-l border-gray-700">
                              Total
                            </th>
                          )}
                        </tr>
                        <tr className="border-b border-gray-700">
                          <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 sticky left-0 z-20"></th>
                          {deliveryPartnerAnalysisShowTime && deliveryPartnerAnalysisTimePeriods.length > 0 ? (
                            deliveryPartnerAnalysisTimePeriods.map((timeKey) => (
                              <React.Fragment key={timeKey}>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Delivered</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Cancelled</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">In Transit</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO</th>
                                <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Other</th>
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right border-l border-gray-700">Delivered</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Cancelled</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">In Transit</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">RTO</th>
                              <th className="pb-3 pr-6 text-sm font-semibold text-gray-300 bg-gray-800 text-right">Other</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDeliveryPartnerAnalysisData.map((item, index) => {
                          const overallData = deliveryPartnerAnalysisTableView === 'overall'
                            ? item.timePeriods?.[0]
                            : null
                          
                          return (
                            <tr 
                              key={index} 
                              className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                            >
                              <td className="py-3 pr-6 text-white font-medium sticky left-0 bg-gray-800/95">
                                <div className="flex flex-col">
                                  <span className="font-semibold">{item.state}</span>
                                  <span className="text-xs text-gray-400">{item.courier}</span>
                                </div>
                              </td>
                              {deliveryPartnerAnalysisShowTime && deliveryPartnerAnalysisTimePeriods.length > 0 ? (
                                deliveryPartnerAnalysisTimePeriods.map((timeKey) => {
                                  const timeData = item.timePeriods?.find((tp: any) => tp.timeKey === timeKey)
                                  return (
                                    <React.Fragment key={timeKey}>
                                      <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                        {timeData ? timeData.delivered.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.cancelled.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.in_transit.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.rto.toLocaleString('en-IN') : '-'}
                                      </td>
                                      <td className="py-3 pr-6 text-white text-right">
                                        {timeData ? timeData.other.toLocaleString('en-IN') : '-'}
                                      </td>
                                    </React.Fragment>
                                  )
                                })
                              ) : (
                                <>
                                  <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                    {overallData ? overallData.delivered.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.cancelled.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.in_transit.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.rto.toLocaleString('en-IN') : '-'}
                                  </td>
                                  <td className="py-3 pr-6 text-white text-right">
                                    {overallData ? overallData.other.toLocaleString('en-IN') : '-'}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        {/* Total Row */}
                        {filteredDeliveryPartnerAnalysisData.length > 0 && (
                          <tr className="border-t-2 border-gray-600 font-semibold">
                            <td className="py-3 pr-6 text-white sticky left-0 bg-gray-800/95">Total</td>
                            {deliveryPartnerAnalysisShowTime && deliveryPartnerAnalysisTimePeriods.length > 0 ? (
                              deliveryPartnerAnalysisTimePeriods.map((timeKey) => {
                                const totalDelivered = filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.delivered : 0)
                                }, 0)
                                const totalCancelled = filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.cancelled : 0)
                                }, 0)
                                const totalInTransit = filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.in_transit : 0)
                                }, 0)
                                const totalRto = filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.rto : 0)
                                }, 0)
                                const totalOther = filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                  const timeData = item.timePeriods.find((tp: any) => tp.timeKey === timeKey)
                                  return sum + (timeData ? timeData.other : 0)
                                }, 0)
                                return (
                                  <React.Fragment key={timeKey}>
                                    <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                      {totalDelivered.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 pr-6 text-white text-right">
                                      {totalCancelled.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 pr-6 text-white text-right">
                                      {totalInTransit.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 pr-6 text-white text-right">
                                      {totalRto.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 pr-6 text-white text-right">
                                      {totalOther.toLocaleString('en-IN')}
                                    </td>
                                  </React.Fragment>
                                )
                              })
                            ) : (
                              <>
                                <td className="py-3 pr-6 text-white text-right border-l border-gray-700/50">
                                  {filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                    return sum + (item.timePeriods[0]?.delivered || 0)
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 pr-6 text-white text-right">
                                  {filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                    return sum + (item.timePeriods[0]?.cancelled || 0)
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 pr-6 text-white text-right">
                                  {filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                    return sum + (item.timePeriods[0]?.in_transit || 0)
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 pr-6 text-white text-right">
                                  {filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                    return sum + (item.timePeriods[0]?.rto || 0)
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                                <td className="py-3 pr-6 text-white text-right">
                                  {filteredDeliveryPartnerAnalysisData.reduce((sum, item) => {
                                    return sum + (item.timePeriods[0]?.other || 0)
                                  }, 0).toLocaleString('en-IN')}
                                </td>
                              </>
                            )}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isDeliveryPartnerAnalysisVisible ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  {deliveryPartnerAnalysisTableView === 'day' && rawShippingData.length === 0
                    ? 'Loading daily data...'
                    : 'No data available'}
                </div>
              ) : null}
            </motion.div>
          </>
        )}
        </main>
      </div>
    </div>
  )
}

export default function AnalyticsDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <AnalyticsDashboardContent />
    </Suspense>
  )
}
