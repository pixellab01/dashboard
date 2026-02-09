'use client'

import React, { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import AnalyticsFilters, { FilterState } from '@/app/components/AnalyticsFilters'
import TopTenStatesTable from '@/app/components/Charts/TopTenStatesTable'
import TopTenCouriersTable from '@/app/components/Charts/TopTenCouriersTable'
import { computeAnalytics, getFilterOptions } from '@/lib/api-client'
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

export default function InteractiveDashboard({ initialAnalyticsData, initialFilterOptions, serverSessionId }: { initialAnalyticsData: any, initialFilterOptions: any, serverSessionId: string | null }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(serverSessionId)
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    orderStatus: [],
    paymentMethod: [],
    channel: [],
    state: [],
    courier: [],
    sku: [],
    productName: [],
    ndrDescription: [],
  })
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [availableStates, setAvailableStates] = useState<string[]>([])
  const [availableCouriers, setAvailableCouriers] = useState<string[]>([])
  const [availableSkus, setAvailableSkus] = useState<string[]>([])
  const [availableSkusTop10, setAvailableSkusTop10] = useState<string[]>([])
  const [availableProductNames, setAvailableProductNames] = useState<string[]>([])
  const [availableProductNamesTop10, setAvailableProductNamesTop10] = useState<string[]>([])
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<string[]>([])
  const [availableNdrDescriptions, setAvailableNdrDescriptions] = useState<string[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Data states
  const [weeklySummary, setWeeklySummary] = useState<any[]>(initialAnalyticsData.weekly_summary || [])
  const [rawShippingData, setRawShippingData] = useState<any[]>(initialAnalyticsData.raw_shipping || [])
  const [ndrWeekly, setNdrWeekly] = useState<any[]>(initialAnalyticsData.ndr_weekly || [])
  const [categoryShare, setCategoryShare] = useState<any[]>(initialAnalyticsData.category_share || [])
  const [cancellationData, setCancellationData] = useState<any[]>(initialAnalyticsData.cancellation_tracker || [])
  const [channelShare, setChannelShare] = useState<any[]>(initialAnalyticsData.channel_share || [])
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>(initialAnalyticsData.payment_method || [])
  const [orderStatusesData, setOrderStatusesData] = useState<any[]>(initialAnalyticsData.order_statuses || [])
  const [paymentMethodOutcomeData, setPaymentMethodOutcomeData] = useState<any[]>(initialAnalyticsData.payment_method_outcome || [])
  const [statusCategories, setStatusCategories] = useState<string[]>(initialAnalyticsData.status_categories || [])
  const [productAnalysisData, setProductAnalysisData] = useState<any[]>(initialAnalyticsData.product_analysis || [])
  const [topTenStatesData, setTopTenStatesData] = useState<any[]>(initialAnalyticsData['top-10-states'] || [])
  const [topTenCouriersData, setTopTenCouriersData] = useState<any[]>(initialAnalyticsData['top-10-couriers'] || [])
  const [addressTypeShareData, setAddressTypeShareData] = useState<any[]>(initialAnalyticsData.address_type_share || [])
  const [cancellationReasonTrackerData, setCancellationReasonTrackerData] = useState<any[]>(initialAnalyticsData.cancellation_reason_tracker || [])

  // Summary metrics
  const [summaryMetrics, setSummaryMetrics] = useState(initialAnalyticsData.summary_metrics || {
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
  const [isProductsAnalysisVisible, setIsProductsAnalysisVisible] = useState(true)
  const [isAddressTypeShareVisible, setIsAddressTypeShareVisible] = useState(true)
  const [isCancellationReasonTrackerVisible, setIsCancellationReasonTrackerVisible] = useState(true)

  // Separate table view states for each table
  const [productsTableView, setProductsTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [addressTypeShareTableView, setAddressTypeShareTableView] = useState<'day' | 'week' | 'overall'>('overall')
  const [cancellationReasonTrackerTableView, setCancellationReasonTrackerTableView] = useState<'day' | 'week' | 'overall'>('overall')

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
    const currentSessionId = urlSessionId || storedSessionId || serverSessionId

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

    if (currentSessionId !== sessionId) {
      setSessionId(currentSessionId)
    }

    setAvailableChannels(initialFilterOptions.channels || [])
    setAvailableStates(initialFilterOptions.states || [])
    setAvailableCouriers(initialFilterOptions.couriers || [])
    setAvailableSkus(initialFilterOptions.skus || [])
    setAvailableSkusTop10(initialFilterOptions.skusTop10 || [])
    setAvailableProductNames(initialFilterOptions.productNames || [])
    setAvailableProductNamesTop10(initialFilterOptions.productNamesTop10 || [])
    setAvailableStatuses(initialFilterOptions.statuses || [])
    setAvailablePaymentMethods(initialFilterOptions.paymentMethods || [])
    setAvailableNdrDescriptions(initialFilterOptions.ndrDescriptions || [])

    setIsLoading(false)
  }, [router, searchParams, serverSessionId, sessionId, initialFilterOptions])

  // Re-fetch filter options when channel changes
  useEffect(() => {
    const fetchFilteredOptions = async (retryCount = 0) => {
      if (!sessionId) return;

      const MAX_RETRIES = 20;
      const RETRY_DELAY_MS = 2000;

      const channel = filters.channel;
      console.log('Fetching filter options for channel:', channel, `(attempt ${retryCount + 1})`);

      const result = await getFilterOptions(sessionId, channel);
      if (result.success && result.data) {
        setAvailableSkus(result.data.skus || []);
        setAvailableSkusTop10(result.data.skusTop10 || []);
        setAvailableProductNames(result.data.productNames || []);
        setAvailableProductNamesTop10(result.data.productNamesTop10 || []);
        setAvailablePaymentMethods(result.data.paymentMethods || []); // Ensure this is set too
        setAvailableStates(result.data.states || []);
        setAvailableCouriers(result.data.couriers || []);
        setAvailableNdrDescriptions((result.data as any).ndrDescriptions || []);

        // Reset SKU and product name selection when channel changes
        if (filters.sku !== 'All' || filters.productName !== 'All') {
          setFilters(prev => ({
            ...prev,
            sku: 'All',
            productName: 'All'
          }));
        }
      } else if (retryCount < MAX_RETRIES && result.error?.includes('404')) {
        // Retry if 404 (file processing)
        console.log(`Filter options not ready, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return fetchFilteredOptions(retryCount + 1);
      }
    };

    fetchFilteredOptions();
  }, [filters.channel, sessionId]);

  useEffect(() => {
    if (sessionId) {
      fetchAllData(sessionId, filters)
    }
  }, [filters, sessionId])


  const fetchAllData = async (currentSessionId: string, currentFilters: FilterState, retryCount = 0) => {
    const MAX_RETRIES = 30; // Increased to 30 (60 seconds) to handle large file processing
    const RETRY_DELAY_MS = 2000;

    setLoadingData(true);
    setDataError(null);

    console.log('Fetching all data with filters:', currentFilters, `(attempt ${retryCount + 1})`);

    try {
      const result = await computeAnalytics(currentSessionId, currentFilters);

      if (result.success && result.data) {
        console.log('Received data from backend:', result.data);
        // All analytics are now in one payload
        setWeeklySummary(result.data.weekly_summary || []);
        setRawShippingData(result.data.raw_shipping || []);
        setNdrWeekly(result.data.ndr_weekly || []);
        setCategoryShare(result.data.category_share || []);
        setCancellationData(result.data.cancellation_tracker || []);
        setChannelShare(result.data.channel_share || []);
        setPaymentMethodData(result.data.payment_method || []);
        setOrderStatusesData(result.data.order_statuses || []);
        setPaymentMethodOutcomeData(result.data.payment_method_outcome || []);
        setStatusCategories(result.data.status_categories || []);
        setProductAnalysisData(result.data.product_analysis || []);
        setTopTenStatesData(result.data['top-10-states'] || []);
        setTopTenCouriersData(result.data['top-10-couriers'] || []);

        // Map backend field names to frontend expected names
        const backendMetrics = result.data.summary_metrics || {};
        const totalOrders = backendMetrics.total_orders || 0;
        const totalDelivered = backendMetrics.total_delivered || 0;
        const totalNdr = backendMetrics.total_ndr || 0;
        const totalRto = backendMetrics.total_rto || 0;
        const totalGmv = backendMetrics.total_gmv || 0;

        // Calculate in-transit as orders that are not delivered, RTO, or NDR
        const inTransitOrders = Math.max(0, totalOrders - totalDelivered - totalRto - totalNdr);

        setSummaryMetrics({
          syncedOrders: totalOrders,
          gmv: totalGmv,
          inTransitPercent: totalOrders > 0 ? (inTransitOrders / totalOrders) * 100 : 0,
          deliveryPercent: backendMetrics.delivery_rate || 0,
          rtoPercent: backendMetrics.rto_rate || 0,
          inTransitOrders: inTransitOrders,
          deliveredOrders: totalDelivered,
          rtoOrders: totalRto,
          undeliveredOrders: totalNdr,
        });

      } else {
        // If data not found and we haven't exceeded retries, wait and retry
        if (retryCount < MAX_RETRIES && result.error?.includes('404')) {
          console.log(`Data not ready, retrying in ${RETRY_DELAY_MS}ms... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          return fetchAllData(currentSessionId, currentFilters, retryCount + 1);
        }
        throw new Error(result.error || 'Failed to fetch analytics data');
      }
    } catch (error: any) {
      console.error('Error fetching analytics data:', error);
      setDataError(error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters,
    }))
  }

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

  // aggregateDailyDeliveryPerformance REMOVED

  // aggregateWeeklyDeliveryPerformance REMOVED

  // Prepare daily delivery performance data based on table view
  // dailyDeliveryPerformance REMOVED

  // Aggregate products by day/week/overall - returns format similar to NDR Count
  const aggregateProductsByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const productMap = new Map<string, Map<string, any>>()

    // Helper to get date object from record for week calculation
    const getDateFromRecord = (record: any): Date | null => {
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

      if (!orderDateValue) return null

      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(orderDateValue)
      }

      const d = new Date(orderDateValue)
      return isNaN(d.getTime()) ? null : d
    }

    // Pre-calculate min/max date for week view grouping
    let firstDate: Date | null = null
    let lastDate: Date | null = null

    if (view === 'week' && records.length > 0) {
      let minMs = Infinity
      let maxMs = -Infinity
      records.forEach(r => {
        const d = getDateFromRecord(r)
        if (d) {
          const t = d.getTime()
          if (t < minMs) minMs = t
          if (t > maxMs) maxMs = t
        }
      })
      if (minMs !== Infinity) {
        firstDate = new Date(minMs)
        lastDate = new Date(maxMs)
      }
    }

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
        const d = getDateFromRecord(record)
        if (d) {
          timeKey = d.toISOString().split('T')[0]
        }
      } else if (view === 'week') {
        let foundDate = false
        if (firstDate) {
          const d = getDateFromRecord(record)
          if (d) {
            const daysDiff = Math.floor((d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
            const weekIndex = Math.floor(daysDiff / 7)
            const weekStart = new Date(firstDate)
            weekStart.setDate(firstDate.getDate() + weekIndex * 7)
            timeKey = weekStart.toISOString().split('T')[0]
            foundDate = true
          }
        }
        if (!foundDate) {
          timeKey = record.order_week || 'overall'
        }
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
          cancelled: 0,
          ofd: 0,
          ndr: 0,
          intransit: 0,
          fad: 0,
          rvp: 0,
          tatSum: 0,
          tatCount: 0
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

      // Logic for Statuses
      const isDelivered = status === 'DELIVERED'
      const isRTO = status === 'RTO' || status.startsWith('RTO') || status.includes('RETURN TO ORIGIN') || status === 'RTO DELIVERED' || status === 'RTO INITIATED' || status === 'RTO IN TRANSIT' || status === 'RTO NDR'
      const isCancelled = status === 'CANCELLED' || status === 'CANCELED' || status.includes('CANCEL')
      const isOFD = status === 'OUT FOR DELIVERY' || status.includes('OFD') || status.includes('OUT FOR DELIVERY')
      const isIntransit = status === 'IN TRANSIT' || status.includes('TRANSIT') || status === 'PICKED UP'
      const isRVP = status === 'RVP' || status.includes('RVP') || status.includes('RETURN PICKUP')

      // NDR Logic
      const ndr1Date = record['NDR 1 Attempt Date'] || record.ndr_1_attempt_date
      const ndr2Date = record['NDR 2 Attempt Date'] || record.ndr_2_attempt_date
      const ndr3Date = record['NDR 3 Attempt Date'] || record.ndr_3_attempt_date
      const hasNDR = (ndr1Date && ndr1Date !== 'N/A') || (ndr2Date && ndr2Date !== 'N/A') || (ndr3Date && ndr3Date !== 'N/A')

      if (hasNDR) productData.ndr++

      // FAD Logic
      if (isDelivered && !hasNDR) productData.fad++

      if (isDelivered) {
        productData.delivered++
        const orderValue = parseFloat(String(record.order_value)) ||
          parseFloat(String(record.gmv_amount)) ||
          parseFloat(String(record['Order Total'])) ||
          parseFloat(String(record.order__total)) ||
          parseFloat(String(record.total_order_value)) ||
          0
        productData.gmv += orderValue
        productData.margin += marginValue

        // TAT Calculation (Order to Delivery)
        const orderDate = getDateFromRecord(record)
        const deliveryDateStr = record.delivered_date || record['Delivered Date'] || record.delivery_date || record['Delivery Date']
        if (orderDate && deliveryDateStr) {
          let deliveryDate: Date | null = null
          if (typeof deliveryDateStr === 'string' && deliveryDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            deliveryDate = new Date(deliveryDateStr)
          } else {
            const d = new Date(deliveryDateStr)
            if (!isNaN(d.getTime())) deliveryDate = d
          }

          if (deliveryDate) {
            const diffTime = Math.abs(deliveryDate.getTime() - orderDate.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            productData.tatSum += diffDays
            productData.tatCount++
          }
        }
      }

      if (isRTO) productData.rto++
      if (isCancelled) productData.cancelled++
      if (isOFD) productData.ofd++
      if (isIntransit) productData.intransit++
      if (isRVP) productData.rvp++

      // Existing return logic
      const isReturned = status === 'RETURNED' ||
        status === 'RETURN' ||
        status.includes('RETURN') ||
        String(record.return_status || '').toUpperCase().includes('RETURN') ||
        String(record['Return Status'] || '').toUpperCase().includes('RETURN')

      if (isDelivered && isReturned) {
        productData.returned++
      }
    })

    // Convert to array format
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

      // Helper to process data for a time key
      const processData = (timeKey: string, timeLabel: string | null) => {
        const data = timeMap.get(timeKey) || {
          orders: 0, delivered: 0, rto: 0, returned: 0, gmv: 0, margin: 0,
          cancelled: 0, ofd: 0, ndr: 0, intransit: 0, fad: 0, rvp: 0, tatSum: 0, tatCount: 0
        }
        const totalOrders = totalOrdersMap.get(timeKey) || (timeKey === 'overall' ? data.orders : 0)

        const orderShare = totalOrders > 0 ? (data.orders / totalOrders) * 100 : 0
        const deliveredPercent = data.orders > 0 ? (data.delivered / data.orders) * 100 : 0
        const rtoPercent = data.orders > 0 ? (data.rto / data.orders) * 100 : 0
        const returnedPercent = data.delivered > 0 ? (data.returned / data.delivered) * 100 : 0

        const fadPercent = data.orders > 0 ? (data.fad / data.orders) * 100 : 0
        const ofdPercent = data.orders > 0 ? (data.ofd / data.orders) * 100 : 0
        const ndrPercent = data.orders > 0 ? (data.ndr / data.orders) * 100 : 0
        const intransitPercent = data.orders > 0 ? (data.intransit / data.orders) * 100 : 0
        const canceledPercent = data.orders > 0 ? (data.cancelled / data.orders) * 100 : 0
        const rvpPercent = data.orders > 0 ? (data.rvp / data.orders) * 100 : 0

        const orderTat = data.tatCount > 0 ? data.tatSum / data.tatCount : 0

        return {
          time: timeLabel,
          timeKey: timeKey,
          orders: data.orders,
          gmv: data.gmv,
          delivery: data.delivered,
          cancel: data.cancelled,
          rto: data.rto,
          margin: data.margin,
          orderShare: orderShare,
          deliveredPercent: deliveredPercent,
          rtoPercent: rtoPercent,
          orderTat: orderTat,
          fadPercent: fadPercent,
          ofdPercent: ofdPercent,
          ndrPercent: ndrPercent,
          intransitPercent: intransitPercent,
          canceledPercent: canceledPercent,
          rvpPercent: rvpPercent,
          returnedPercent: returnedPercent
        }
      }

      if (view === 'overall') {
        timePeriods.push(processData('overall', null))
      } else {
        sortedTimePeriods.forEach((timeKey) => {
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
            }
          } else if (view === 'week') {
            if (firstDate && lastDate && timeKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const weekStart = new Date(timeKey)
              if (!isNaN(weekStart.getTime())) {
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 6)
                if (weekEnd > lastDate) {
                  weekEnd.setTime(lastDate.getTime())
                }
                const startDay = weekStart.getDate()
                const endDay = weekEnd.getDate()
                const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
                const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
                const year = weekStart.getFullYear()
                if (startMonth === endMonth) {
                  formattedTime = `${startDay}-${endDay} ${startMonth} ${year}`
                } else {
                  formattedTime = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`
                }
              } else {
                formattedTime = formatDate(timeKey, false)
              }
            } else {
              formattedTime = formatDate(timeKey, false)
            }
          }
          timePeriods.push(processData(timeKey, formattedTime))
        })
      }

      result.push({
        product_name: productName,
        timePeriods: timePeriods,
      })
    })

    // Sort by total orders (descending) - sum across all time periods
    result.sort((a, b) => {
      const ordersA = a.timePeriods.find((tp: any) => tp.timeKey === 'overall')?.orders || 0
      const ordersB = b.timePeriods.find((tp: any) => tp.timeKey === 'overall')?.orders || 0
      return ordersB - ordersA
    })

    return result
  }

  // Aggregate states by day/week/overall - returns format similar to NDR Count
  const aggregateStatesByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const stateMap = new Map<string, Map<string, any>>()

    // Helper to get date object from record for week calculation
    const getDateFromRecord = (record: any): Date | null => {
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

      if (!orderDateValue) return null

      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(orderDateValue)
      }

      const d = new Date(orderDateValue)
      return isNaN(d.getTime()) ? null : d
    }

    // Pre-calculate min/max date for week view grouping
    let firstDate: Date | null = null
    let lastDate: Date | null = null

    if (view === 'week' && records.length > 0) {
      let minMs = Infinity
      let maxMs = -Infinity
      records.forEach(r => {
        const d = getDateFromRecord(r)
        if (d) {
          const t = d.getTime()
          if (t < minMs) minMs = t
          if (t > maxMs) maxMs = t
        }
      })
      if (minMs !== Infinity) {
        firstDate = new Date(minMs)
        lastDate = new Date(maxMs)
      }
    }

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
        let foundDate = false
        if (firstDate) {
          const d = getDateFromRecord(record)
          if (d) {
            const daysDiff = Math.floor((d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
            const weekIndex = Math.floor(daysDiff / 7)
            const weekStart = new Date(firstDate)
            weekStart.setDate(firstDate.getDate() + weekIndex * 7)
            timeKey = weekStart.toISOString().split('T')[0]
            foundDate = true
          }
        }
        if (!foundDate) {
          timeKey = record.order_week || 'overall'
        }
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
          order_share: orderShare,
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
            if (firstDate && lastDate && timeKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const weekStart = new Date(timeKey)
              if (!isNaN(weekStart.getTime())) {
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 6)

                // Cap at lastDate
                if (weekEnd > lastDate) {
                  weekEnd.setTime(lastDate.getTime())
                }

                const startDay = weekStart.getDate()
                const endDay = weekEnd.getDate()
                const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
                const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
                const year = weekStart.getFullYear()

                if (startMonth === endMonth) {
                  formattedTime = `${startDay}-${endDay} ${startMonth} ${year}`
                } else {
                  formattedTime = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`
                }
              } else {
                formattedTime = formatDate(timeKey, false)
              }
            } else {
              formattedTime = formatDate(timeKey, false)
            }
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            total_orders: data.total_orders,
            del_count: data.del_count,
            rto_count: data.rto_count,
            delivered_percent: deliveredPercent,
            rto_percent: rtoPercent,
            order_share: orderShare,
          })
        })
      }

      result.push({
        state: state,
        timePeriods: timePeriods,
      })
    })

    // Sort by total orders (descending)
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.total_orders, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Aggregate NDR count by day/week/overall from raw shipping data
  const aggregateNdrCountByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const ndrMap = new Map<string, Map<string, any>>()

    // Helper to get date object from record for week calculation
    const getDateFromRecord = (record: any): Date | null => {
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

      if (!orderDateValue) return null

      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(orderDateValue)
      }

      const d = new Date(orderDateValue)
      return isNaN(d.getTime()) ? null : d
    }

    // Pre-calculate min/max date for week view grouping
    let firstDate: Date | null = null
    let lastDate: Date | null = null

    if (view === 'week' && records.length > 0) {
      let minMs = Infinity
      let maxMs = -Infinity
      records.forEach(r => {
        const d = getDateFromRecord(r)
        if (d) {
          const t = d.getTime()
          if (t < minMs) minMs = t
          if (t > maxMs) maxMs = t
        }
      })
      if (minMs !== Infinity) {
        firstDate = new Date(minMs)
        lastDate = new Date(maxMs)
      }
    }

    records.forEach((record: any) => {
      // Try to get NDR reason from various possible fields
      const ndrReason = record.ndr_reason ||
        record.latest__n_d_r__reason ||
        record.latest_ndr_reason ||
        record.n_d_r__reason ||
        record.ndrReason ||
        record['Latest NDR Reason'] ||
        record['NDR Reason'] ||
        record.reason ||
        'Unknown'

      // Skip if it's truly unknown and we only want valid reasons, 
      // but usually we want to see 'Unknown' too if that's all we have.
      // For now, let's include 'Unknown' to ensure data shows up.

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
        let foundDate = false
        if (firstDate) {
          const d = getDateFromRecord(record)
          if (d) {
            const daysDiff = Math.floor((d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
            const weekIndex = Math.floor(daysDiff / 7)
            const weekStart = new Date(firstDate)
            weekStart.setDate(firstDate.getDate() + weekIndex * 7)
            timeKey = weekStart.toISOString().split('T')[0]
            foundDate = true
          }
        }
        if (!foundDate) {
          timeKey = record.order_week || 'overall'
        }
      }

      // Initialize NDR reason map if not exists
      if (!ndrMap.has(ndrReason)) {
        ndrMap.set(ndrReason, new Map())
      }

      const timeMap = ndrMap.get(ndrReason)!

      // Initialize time period if not exists
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, {
          count: 0,
          del_count: 0,
        })
      }

      const ndrData = timeMap.get(timeKey)!
      ndrData.count++

      const status = String(
        record.original_status ||
        record['Status'] ||
        record.status ||
        record.delivery_status ||
        ''
      ).toUpperCase().trim()

      if (status === 'DELIVERED') {
        ndrData.del_count++
      }
    })

    // Convert to array format: [{ ndr_reason, timePeriods: [{ timeKey, count, del_count }] }]
    const result: any[] = []
    const allTimePeriods = new Set<string>()

    ndrMap.forEach((timeMap) => {
      timeMap.forEach((_, timeKey) => {
        if (timeKey !== 'overall') {
          allTimePeriods.add(timeKey)
        }
      })
    })
    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))

    ndrMap.forEach((timeMap, ndrReason) => {
      const timePeriods: any[] = []

      if (view === 'overall') {
        const overallData = timeMap.get('overall') || { count: 0, del_count: 0 }
        timePeriods.push({
          time: null,
          timeKey: 'overall',
          count: overallData.count,
          del_count: overallData.del_count,
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const data = timeMap.get(timeKey) || { count: 0, del_count: 0 }

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
            if (firstDate && lastDate && timeKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const weekStart = new Date(timeKey)
              if (!isNaN(weekStart.getTime())) {
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 6)

                // Cap at lastDate
                if (weekEnd > lastDate) {
                  weekEnd.setTime(lastDate.getTime())
                }

                const startDay = weekStart.getDate()
                const endDay = weekEnd.getDate()
                const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
                const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
                const year = weekStart.getFullYear()

                if (startMonth === endMonth) {
                  formattedTime = `${startDay}-${endDay} ${startMonth} ${year}`
                } else {
                  formattedTime = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`
                }
              } else {
                formattedTime = formatDate(timeKey, false)
              }
            } else {
              formattedTime = formatDate(timeKey, false)
            }
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            count: data.count,
            del_count: data.del_count,
          })
        })
      }

      result.push({
        ndr_reason: ndrReason,
        timePeriods: timePeriods,
      })
    })

    // Sort by total count (descending)
    result.sort((a, b) => {
      const aTotal = a.timePeriods.reduce((sum: number, tp: any) => sum + tp.count, 0)
      const bTotal = b.timePeriods.reduce((sum: number, tp: any) => sum + tp.count, 0)
      return bTotal - aTotal
    })

    return result
  }

  // Aggregate address type share by day/week/overall from raw shipping data
  const aggregateAddressTypeShareByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    const addressMap = new Map<string, Map<string, any>>()
    const totalOrdersMap = new Map<string, number>()

    // Helper to get date object from record for week calculation
    const getDateFromRecord = (record: any): Date | null => {
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

      if (!orderDateValue) return null

      if (typeof orderDateValue === 'string' && orderDateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(orderDateValue)
      }

      const d = new Date(orderDateValue)
      return isNaN(d.getTime()) ? null : d
    }

    // Pre-calculate min/max date for week view grouping
    let firstDate: Date | null = null
    let lastDate: Date | null = null

    if (view === 'week' && records.length > 0) {
      let minMs = Infinity
      let maxMs = -Infinity
      records.forEach(r => {
        const d = getDateFromRecord(r)
        if (d) {
          const t = d.getTime()
          if (t < minMs) minMs = t
          if (t > maxMs) maxMs = t
        }
      })
      if (minMs !== Infinity) {
        firstDate = new Date(minMs)
        lastDate = new Date(maxMs)
      }
    }

    records.forEach((record: any) => {
      // Get address quality/type
      const rawType = record.address_quality ||
        record.address_type ||
        record['Address Quality'] ||
        record['Address Type'] ||
        'GOOD'

      let metric = 'Good Address %'
      const upperType = String(rawType).toUpperCase()
      if (upperType === 'INVALID' || upperType.includes('INVALID')) metric = 'Invalid Address%'
      if (upperType === 'SHORT' || upperType.includes('SHORT')) metric = 'Short Address %'

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
        let foundDate = false
        if (firstDate) {
          const d = getDateFromRecord(record)
          if (d) {
            const daysDiff = Math.floor((d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
            const weekIndex = Math.floor(daysDiff / 7)
            const weekStart = new Date(firstDate)
            weekStart.setDate(firstDate.getDate() + weekIndex * 7)
            timeKey = weekStart.toISOString().split('T')[0]
            foundDate = true
          }
        }
        if (!foundDate) {
          timeKey = record.order_week || 'overall'
        }
      }

      // Update total orders for this timeKey
      const currentTotal = totalOrdersMap.get(timeKey) || 0
      totalOrdersMap.set(timeKey, currentTotal + 1)

      if (!addressMap.has(metric)) {
        addressMap.set(metric, new Map())
      }

      const timeMap = addressMap.get(metric)!

      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, { count: 0 })
      }

      const addressData = timeMap.get(timeKey)!
      addressData.count++
    })

    const result: any[] = []
    const allTimePeriods = new Set<string>()

    // Ensure all metrics are present even if count is 0
    const metrics = ['Invalid Address%', 'Short Address %', 'Good Address %']
    metrics.forEach(metric => {
      if (!addressMap.has(metric)) {
        addressMap.set(metric, new Map())
      }
    })

    // Collect all time keys from totals map to ensure complete coverage
    totalOrdersMap.forEach((_, timeKey) => {
      if (timeKey !== 'overall') {
        allTimePeriods.add(timeKey)
      }
    })

    const sortedTimePeriods = Array.from(allTimePeriods).sort((a, b) => b.localeCompare(a))

    metrics.forEach(metric => {
      const timeMap = addressMap.get(metric)!
      const timePeriods: any[] = []

      if (view === 'overall') {
        const overallTotal = totalOrdersMap.get('overall') || 0
        const overallCount = (timeMap.get('overall') || { count: 0 }).count
        const percentage = overallTotal > 0 ? (overallCount / overallTotal) * 100 : 0

        timePeriods.push({
          time: null,
          timeKey: 'overall',
          percentage: percentage,
          count: overallCount,
          total: overallTotal
        })
      } else {
        sortedTimePeriods.forEach((timeKey) => {
          const totalOrders = totalOrdersMap.get(timeKey) || 0
          const data = timeMap.get(timeKey) || { count: 0 }
          const percentage = totalOrders > 0 ? (data.count / totalOrders) * 100 : 0

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
            if (firstDate && lastDate && timeKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const weekStart = new Date(timeKey)
              if (!isNaN(weekStart.getTime())) {
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 6)

                // Cap at lastDate
                if (weekEnd > lastDate) {
                  weekEnd.setTime(lastDate.getTime())
                }

                const startDay = weekStart.getDate()
                const endDay = weekEnd.getDate()
                const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
                const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
                const year = weekStart.getFullYear()

                if (startMonth === endMonth) {
                  formattedTime = `${startDay}-${endDay} ${startMonth} ${year}`
                } else {
                  formattedTime = `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`
                }
              } else {
                formattedTime = formatDate(timeKey, false)
              }
            } else {
              formattedTime = formatDate(timeKey, false)
            }
          }

          timePeriods.push({
            time: formattedTime,
            timeKey: timeKey,
            percentage: percentage,
            count: data.count,
            total: totalOrders
          })
        })
      }

      result.push({
        metric: metric,
        timePeriods: timePeriods,
      })
    })

    return result
  }

  // aggregateAverageOrderTatByTime REMOVED

  // aggregateFadDelCanRtoByTime REMOVED

  // Aggregate cancellation reasons by day/week/overall from raw shipping data
  const aggregateCancellationReasonsByTime = (records: any[], view: 'day' | 'week' | 'overall'): any[] => {
    // Similar aggregation logic for cancellation reasons
    return [] // Placeholder
  }


  const memoizedProductsData = useMemo(() => aggregateProductsByTime(rawShippingData, productsTableView), [rawShippingData, productsTableView])
  // memoizedStatesData REMOVED
  // memoizedNdrCountData REMOVED
  const memoizedAddressTypeShareData = useMemo(() => aggregateAddressTypeShareByTime(rawShippingData, addressTypeShareTableView), [rawShippingData, addressTypeShareTableView])
  // memoizedAverageOrderTatData REMOVED
  // memoizedFadDelCanRtoData REMOVED
  const memoizedCancellationReasonTrackerData = useMemo(() => aggregateCancellationReasonsByTime(rawShippingData, cancellationReasonTrackerTableView), [rawShippingData, cancellationReasonTrackerTableView])

  // filteredStates REMOVED

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-lg my-4">
        <p className="font-bold text-lg mb-2">Data Loading Error</p>
        <p className="mb-2">{dataError}</p>
        <p className="text-sm">
          This usually means that the session has expired or the data file has not been processed yet.
          Please go to the <a href="/admin" className="text-blue-500 hover:underline font-semibold">Admin Page</a> to upload a new shipping file.
        </p>
      </div>
    )
  }

  const formatYAxis = (value: number) => {
    if (value === undefined || value === null) return '0'
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  // Common Table Component with Pagination
  const AnalyticsTable = ({
    title,
    data,
    columns,
    tableView,
    setTableView,
    isExpanded,
    setIsExpanded,
    searchQuery,
    setSearchQuery,
    searchPlaceholder,
    extraControls,
  }: {
    title: string,
    data: any[],
    columns: { header: string, accessor: (row: any) => any, timePeriodAccessor?: (time: any) => any, headerClass?: string, cellClass?: string, isTimePeriod?: boolean }[],
    tableView: 'day' | 'week' | 'overall',
    setTableView: (view: 'day' | 'week' | 'overall') => void,
    isExpanded: boolean,
    setIsExpanded: (isExpanded: boolean) => void,
    searchQuery?: string,
    setSearchQuery?: (query: string) => void,
    searchPlaceholder?: string,
    extraControls?: React.ReactNode,
  }) => {
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const timePeriods = data.length > 0 ? data[0].timePeriods.map((tp: any) => tp.time).filter(Boolean) : []

    // Calculate pagination
    const totalPages = Math.ceil(data.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedData = data.slice(startIndex, startIndex + itemsPerPage)

    // Reset to page 1 when data changes
    React.useEffect(() => {
      setCurrentPage(1)
    }, [data.length, tableView])

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="flex items-center space-x-2">
            {setSearchQuery && (
              <input
                type="text"
                placeholder={searchPlaceholder || 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-700 text-white px-3 py-1 rounded-md"
              />
            )}
            {extraControls}
            <div className="bg-gray-700 p-1 rounded-md flex">
              <button
                onClick={() => setTableView('day')}
                className={`px-3 py-1 text-sm rounded ${tableView === 'day' ? 'bg-blue-600' : ''}`}
              >
                Day
              </button>
              <button
                onClick={() => setTableView('week')}
                className={`px-3 py-1 text-sm rounded ${tableView === 'week' ? 'bg-blue-600' : ''}`}
              >
                Week
              </button>
              <button
                onClick={() => setTableView('overall')}
                className={`px-3 py-1 text-sm rounded ${tableView === 'overall' ? 'bg-blue-600' : ''}`}
              >
                Overall
              </button>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-gray-300">
                <thead className="bg-gray-700">
                  <tr>
                    {columns.map(col => (
                      <th key={col.header} className={`px-4 py-2 ${col.headerClass || ''}`}>{col.header}</th>
                    ))}
                    {tableView !== 'overall' && timePeriods.map(time => (
                      columns.filter(c => c.isTimePeriod).map(col => (
                        <th key={`${time}-${col.header}`} className={`px-4 py-2 text-center ${col.headerClass || ''}`}>{time}</th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-700 hover:bg-gray-600">
                      {columns.map(col => !col.isTimePeriod && (
                        <td key={col.header} className={`px-4 py-2 ${col.cellClass || ''}`}>{col.accessor(row)}</td>
                      ))}
                      {tableView !== 'overall' && row.timePeriods.map((tp: any) => (
                        columns.filter(c => c.isTimePeriod).map(col => (
                          <td key={`${tp.timeKey}-${col.header}`} className={`px-4 py-2 text-center ${col.cellClass || ''}`}>{col.timePeriodAccessor ? col.timePeriodAccessor(tp) : ''}</td>
                        ))
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 px-2">
                <div className="text-gray-400 text-sm">
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, data.length)} of {data.length} items
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded text-sm ${currentPage === pageNum ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded text-sm ${currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    )
  }

  // Specialized Product Analysis Table with Grouped Headers
  const ProductAnalysisTable = ({
    data,
    view,
    setView,
    isExpanded,
    setIsExpanded,
  }: {
    data: any[],
    view: 'day' | 'week' | 'overall',
    setView: (view: 'day' | 'week' | 'overall') => void,
    isExpanded: boolean,
    setIsExpanded: (isExpanded: boolean) => void,
  }) => {
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Calculate pagination
    const totalPages = Math.ceil(data.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedData = data.slice(startIndex, startIndex + itemsPerPage)

    // Reset page on view change
    useEffect(() => {
      setCurrentPage(1)
    }, [view, data.length])

    // Get time periods from first item
    const timePeriods = data.length > 0 ? data[0].timePeriods : []

    const metrics = [
      { key: 'orders', label: 'Orders', format: (val: number) => val.toLocaleString() },
      { key: 'gmv', label: 'GMV', format: (val: number) => `₹${val.toLocaleString()}` },
      { key: 'delivery', label: 'Delivery', format: (val: number) => val.toLocaleString() },
      { key: 'cancel', label: 'Cancel', format: (val: number) => val.toLocaleString() },
      { key: 'rto', label: 'RTO', format: (val: number) => val.toLocaleString() },
      { key: 'margin', label: 'Margin', format: (val: number) => `₹${val.toLocaleString()}` },
      { key: 'orderShare', label: 'Order Share', format: (val: number) => `${val.toFixed(2)}%` },
    ]

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Products Analysis</h2>
          <div className="flex items-center space-x-2">
            <div className="bg-gray-700 p-1 rounded-md flex">
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 text-sm rounded ${view === 'day' ? 'bg-blue-600' : ''}`}
              >
                Day
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 text-sm rounded ${view === 'week' ? 'bg-blue-600' : ''}`}
              >
                Week
              </button>
              <button
                onClick={() => setView('overall')}
                className={`px-3 py-1 text-sm rounded ${view === 'overall' ? 'bg-blue-600' : ''}`}
              >
                Overall
              </button>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <>
            <div className="overflow-x-auto relative">
              <table className="min-w-full text-sm text-left text-gray-300 border-collapse">
                <thead className="bg-gray-700 text-xs uppercase text-gray-300">
                  <tr>
                    <th rowSpan={2} className="px-4 py-2 sticky left-0 z-10 bg-gray-700 border-b border-gray-600 min-w-[200px]">Product Name</th>
                    {timePeriods.map((tp: any, index: number) => (
                      <th key={index} colSpan={metrics.length} className="px-4 py-2 text-center border-b border-gray-600 border-l border-gray-600">
                        {view === 'overall' ? 'Total' : tp.time}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {timePeriods.map((tp: any, tpIndex: number) => (
                      metrics.map((metric) => (
                        <th key={`${tpIndex}-${metric.key}`} className="px-2 py-2 text-right border-b border-gray-600 min-w-[80px] border-l border-gray-600 first:border-l-0">
                          {metric.label}
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row: any, rowIndex: number) => (
                    <tr key={rowIndex} className="group border-b border-gray-700 hover:bg-gray-600">
                      <td className="px-4 py-2 sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-600 border-r border-gray-700 font-medium text-white truncate max-w-[200px]" title={row.product_name}>
                        {row.product_name}
                      </td>
                      {row.timePeriods.map((tp: any, tpIndex: number) => (
                        metrics.map((metric) => (
                          <td key={`${tpIndex}-${metric.key}`} className="px-2 py-2 text-right border-l border-gray-700 first:border-l-0">
                            {metric.format(tp[metric.key] || 0)}
                          </td>
                        ))
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 px-2">
                <div className="text-gray-400 text-sm">
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, data.length)} of {data.length} items
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    Previous
                  </button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded text-sm ${currentPage === pageNum ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded text-sm ${currentPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    )
  }



  // Specialized Address Type Share Table
  const AddressTypeShareTable = ({
    data,
    view,
    setView,
    isExpanded,
    setIsExpanded,
  }: {
    data: any[],
    view: 'day' | 'week' | 'overall',
    setView: (view: 'day' | 'week' | 'overall') => void,
    isExpanded: boolean,
    setIsExpanded: (isExpanded: boolean) => void,
  }) => {
    // Standard table logic but simpler metric
    const timePeriods = data.length > 0 ? data[0].timePeriods : []

    const metrics = [
      { key: 'percentage', label: 'Total', format: (val: number) => `${val.toFixed(1)}%` },
    ]

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Address Type Share</h2>
          <div className="flex items-center space-x-2">
            <div className="bg-gray-700 p-1 rounded-md flex">
              <button
                onClick={() => setView('overall')}
                className={`px-3 py-1 text-sm rounded ${view === 'overall' ? 'bg-blue-600' : ''}`}
                disabled
              >
                Overall
              </button>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="overflow-x-auto relative">
            <table className="min-w-full text-sm text-left text-gray-300 border-collapse">
              <thead className="bg-gray-700 text-xs uppercase text-gray-300">
                <tr>
                  <th className="px-4 py-2 sticky left-0 z-10 bg-gray-700 border-b border-gray-600 min-w-[200px]">Metric</th>
                  {timePeriods.map((tp: any, index: number) => (
                    <th key={index} className="px-4 py-2 text-right border-b border-gray-600 border-l border-gray-600 min-w-[100px]">
                      {view === 'overall' ? 'Total' : tp.time}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, rowIndex: number) => (
                  <tr key={rowIndex} className="group border-b border-gray-700 hover:bg-gray-600">
                    <td className="px-4 py-2 sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-600 border-r border-gray-700 font-medium text-white truncate max-w-[200px]" title={row.metric}>
                      {row.metric}
                    </td>
                    {row.timePeriods.map((tp: any, tpIndex: number) => (
                      <td key={`${tpIndex}`} className="px-4 py-2 text-right border-l border-gray-700 font-medium">
                        {metrics[0].format(tp.percentage || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    )
  }




  return (
    <div className="flex min-h-screen">
      {/* Fixed Left Sidebar for Filters */}
      <aside className="w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto bg-gray-900 border-r border-gray-700 p-4">
        <AnalyticsFilters
          onFilterChange={handleFilterChange}
          availableChannels={availableChannels}
          availableStates={availableStates}
          availableCouriers={availableCouriers}
          availableSkus={availableSkus}
          availableSkusTop10={availableSkusTop10}
          availableProductNames={availableProductNames}
          availableProductNamesTop10={availableProductNamesTop10}
          availableStatuses={availableStatuses}
          availablePaymentMethods={availablePaymentMethods}
          availableNdrDescriptions={availableNdrDescriptions}
          sessionId={sessionId || undefined}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 overflow-x-hidden">
        {loadingData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="text-white text-lg">Loading data...</div>
          </div>
        )}

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Synced Orders', value: summaryMetrics.syncedOrders || 0 },
            { label: 'GMV', value: `₹${formatYAxis(summaryMetrics.gmv || 0)}` },
            { label: 'In-Transit', value: `${(summaryMetrics.inTransitPercent || 0).toFixed(2)}%` },
            { label: 'Delivery', value: `${(summaryMetrics.deliveryPercent || 0).toFixed(2)}%` },
            { label: 'RTO', value: `${(summaryMetrics.rtoPercent || 0).toFixed(2)}%` },
          ].map(metric => (
            <div key={metric.label} className="bg-gray-800 p-4 rounded-lg shadow-lg text-center">
              <h3 className="text-gray-400 text-sm">{metric.label}</h3>
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
          ))}
        </div>

        {/* Delivery Performance Table Removed */}
        {/* State Analysis Table Removed */}
        {/* Ndr Analysis Table Removed */}
        {/* Average Order Tat Table Removed */}
        {/* Fad Del Can Rto Table Removed */}

        <ProductAnalysisTable
          data={memoizedProductsData}
          view={productsTableView}
          setView={setProductsTableView}
          isExpanded={isProductsAnalysisVisible}
          setIsExpanded={setIsProductsAnalysisVisible}
        />

        <AddressTypeShareTable
          data={memoizedAddressTypeShareData}
          view={addressTypeShareTableView}
          setView={setAddressTypeShareTableView}
          isExpanded={isAddressTypeShareVisible}
          setIsExpanded={setIsAddressTypeShareVisible}
        />


        {/* Top 10 States Table */}
        <div className="mb-8">
          <TopTenStatesTable data={topTenStatesData} isLoading={loadingData} />
        </div>

        {/* Top 10 Couriers Table */}
        <div className="mb-8">
          <TopTenCouriersTable data={topTenCouriersData} isLoading={loadingData} />
        </div>
      </main>
    </div>
  )
}

const AnalyticsDashboard = () => {
  return (
    <Suspense fallback={<div>Loading Analytics...</div>}>
      <InteractiveDashboard initialAnalyticsData={{}} initialFilterOptions={{}} serverSessionId={null} />
    </Suspense>
  )
}
