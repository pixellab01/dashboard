'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { fetchAnalytics as fetchAnalyticsFromAPI, computeAnalytics } from '@/lib/api-client'
import NDRWeeklyChart from '@/app/components/Charts/NDRWeeklyChart'
import StatePerformanceChart from '@/app/components/Charts/StatePerformanceChart'
import WeeklySummaryChart from '@/app/components/Charts/WeeklySummaryChart'
import CategoryShareChart from '@/app/components/Charts/CategoryShareChart'
import CancellationChart from '@/app/components/Charts/CancellationChart'
import DateRangeFilter from '@/app/components/DateRangeFilter'

interface User {
  email: string
  role: string
  name: string
}

interface ReportData {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  uniqueChannels: string[]
}

interface AnalyticsMetrics {
  order_week: string
  total_orders: number
  total_order_value: number
  avg_order_value: number
  total_ndr: number
  ndr_delivered_after: number
  ndr_rate_percent: number
  ndr_conversion_percent: number
  fad_count: number
  ofd_count: number
  del_count: number
  ndr_count: number
  rto_count: number
  avg_total_tat: number
}

interface WeeklySummaryData {
  order_week: string
  total_orders: number
  total_order_value: number
  avg_order_value: number
  fad_count: number
  fad_percent: number
  ofd_count: number
  ofd_percent: number
  del_count: number
  del_percent: number
  ndr_count: number
  ndr_rate_percent: number
  rto_count: number
  rto_rate_percent: number
  avg_total_tat: number
}

// Transform AnalyticsMetrics to WeeklySummaryData by calculating percentages
function transformToWeeklySummaryData(metrics: AnalyticsMetrics[]): WeeklySummaryData[] {
  return metrics.map((m) => ({
    order_week: m.order_week,
    total_orders: m.total_orders,
    total_order_value: m.total_order_value,
    avg_order_value: m.avg_order_value,
    fad_count: m.fad_count,
    fad_percent: m.total_orders > 0 ? (m.fad_count / m.total_orders) * 100 : 0,
    ofd_count: m.ofd_count,
    ofd_percent: m.total_orders > 0 ? (m.ofd_count / m.total_orders) * 100 : 0,
    del_count: m.del_count,
    del_percent: m.total_orders > 0 ? (m.del_count / m.total_orders) * 100 : 0,
    ndr_count: m.ndr_count,
    ndr_rate_percent: m.ndr_rate_percent,
    rto_count: m.rto_count,
    rto_rate_percent: m.total_orders > 0 ? (m.rto_count / m.total_orders) * 100 : 0,
    avg_total_tat: m.avg_total_tat,
  }))
}

function ReportsPageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [ndrData, setNdrData] = useState<any[]>([])
  const [stateData, setStateData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [cancellationData, setCancellationData] = useState<any[]>([])
  const [channelData, setChannelData] = useState<any[]>([])
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if user is authenticated
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
    setIsLoading(false)
    fetchReports()

    // Check for report parameter in URL
    try {
      const reportParam = searchParams?.get('report')
      if (reportParam) {
        setSelectedReport(reportParam)
      }
    } catch (error) {
      // Handle searchParams not available
      console.error('Error reading search params:', error)
    }
    
    // Initial data fetch
    fetchAllAnalytics()
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams])

  const fetchReports = async () => {
    try {
      const { getStats } = await import('@/lib/api-client')
      const result = await getStats()
      
      if (result.success && result.data) {
        setReportData({
          totalUsers: result.data.totalUsers || 0,
          totalProducts: 0, // Not available from stats endpoint
          totalOrders: 0, // You can add this later
          totalRevenue: 0, // You can add this later
          uniqueChannels: [],
        })
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoadingReports(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      // Get session ID from localStorage
      const currentSessionId = localStorage.getItem('analyticsSessionId')
      if (!currentSessionId) {
        console.warn('No session ID available')
        return
      }
      
      // Fetch all weekly summary data
      const { fetchAnalytics } = await import('@/lib/api-client')
      const result = await fetchAnalytics('weekly-summary', { sessionId: currentSessionId })
      
      if (result.success && result.data) {
        setAnalyticsMetrics(result.data)
        console.log(`Fetched ${result.count || 0} weekly summary records`)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const fetchAllAnalytics = async () => {
    try {
      // Get session ID from localStorage
      const currentSessionId = localStorage.getItem('analyticsSessionId')
      if (!currentSessionId) {
        console.warn('No session ID available')
        return
      }

      // Build params for Python backend
      const params = {
        sessionId: currentSessionId,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      }

      // Fetch NDR Weekly - all data
      const ndrResult = await fetchAnalyticsFromAPI('ndr-weekly', params)
      if (ndrResult.success) {
        setNdrData((ndrResult.data || []) as any[])
        console.log(`Fetched ${ndrResult.count || 0} NDR weekly records`)
      }

      // Fetch State Performance - all data
      const stateResult = await fetchAnalyticsFromAPI('state-performance', params)
      if (stateResult.success) {
        setStateData((stateResult.data || []) as any[])
        console.log(`Fetched ${stateResult.count || 0} state performance records`)
      }

      // Fetch Category Share - all data
      const categoryResult = await fetchAnalyticsFromAPI('category-share', params)
      if (categoryResult.success) {
        setCategoryData((categoryResult.data || []) as any[])
        console.log(`Fetched ${categoryResult.count || 0} category records`)
      }

      // Fetch Channel Share - all data
      const channelResult = await fetchAnalyticsFromAPI('channel-share', params)
      if (channelResult.success) {
        setChannelData((channelResult.data || []) as any[])
        console.log(`Fetched ${channelResult.count || 0} channel records`)
      }

      // Fetch Cancellation Tracker - all data
      const cancellationResult = await fetchAnalyticsFromAPI('cancellation-tracker', params)
      if (cancellationResult.success) {
        setCancellationData((cancellationResult.data || []) as any[])
        console.log(`Fetched ${cancellationResult.count || 0} cancellation records`)
      }

      // Fetch Weekly Summary - all data
      const weeklyResult = await fetchAnalyticsFromAPI('weekly-summary', params)
      if (weeklyResult.success) {
        setAnalyticsMetrics((weeklyResult.data || []) as AnalyticsMetrics[])
        console.log(`Fetched ${weeklyResult.count || 0} weekly summary records`)
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    }
  }

  const handleDateRangeChange = (startDate: string | null, endDate: string | null) => {
    setDateRange({ startDate, endDate })
  }

  useEffect(() => {
    // Only refetch if date range is actually set
    fetchAllAnalytics()
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate])

  const handleBack = () => {
    router.push('/admin')
  }

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
      <header className="bg-black/40 backdrop-blur-lg border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                onClick={handleBack}
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
                className="text-2xl font-bold text-white"
              >
                Reports
              </motion.h1>
            </div>
            <motion.button
              onClick={() => router.push('/')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              title="Logout"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Range Filter */}
        <DateRangeFilter
          onDateChange={handleDateRangeChange}
          defaultStartDate={dateRange.startDate || undefined}
          defaultEndDate={dateRange.endDate || undefined}
        />

        {/* Report Viewer */}
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedReport === 'ndr-analytics' && 'NDR Analytics'}
                  {selectedReport === 'state-performance' && 'State Performance'}
                  {selectedReport === 'operational-metrics' && 'Operational Metrics'}
                  {selectedReport === 'category-analytics' && 'Category Analytics'}
                  {selectedReport === 'cancellation-tracking' && 'Cancellation Tracking'}
                  {!['ndr-analytics', 'state-performance', 'operational-metrics', 'category-analytics', 'cancellation-tracking'].includes(selectedReport) && 'Analytics Report'}
                </h2>
                <button
                  onClick={() => {
                    setSelectedReport(null)
                    router.push('/admin/reports')
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>

              {selectedReport === 'ndr-analytics' && (
                <div>
                  {ndrData.length > 0 ? (
                    <NDRWeeklyChart data={ndrData} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No NDR data available for the selected time period.</p>
                      <div className="space-y-2">
                        <p className="text-gray-500 text-sm">This could mean:</p>
                        <ul className="text-gray-500 text-sm list-disc list-inside space-y-1">
                          <li>Analytics haven't been computed yet</li>
                          <li>No data exists for the selected date range</li>
                          <li>No orders with NDR status in this period</li>
                        </ul>
                        <div className="mt-6">
                          <button
                            onClick={async () => {
                              try {
                                const currentSessionId = localStorage.getItem('analyticsSessionId') || ''
                                const result = await computeAnalytics(currentSessionId)
                                if (result.success) {
                                  alert('Analytics computed successfully! Refreshing data...')
                                  fetchAllAnalytics()
                                } else {
                                  alert(`Error: ${result.error}`)
                                }
                              } catch (error: any) {
                                alert(`Failed to compute analytics: ${error.message}`)
                              }
                            }}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            Compute Analytics Now
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedReport === 'state-performance' && (
                <div>
                  {stateData.length > 0 ? (
                    <StatePerformanceChart data={stateData} limit={undefined} channelData={channelData} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No state performance data available.</p>
                      <button
                        onClick={async () => {
                          try {
                            const currentSessionId = localStorage.getItem('analyticsSessionId')
                            if (!currentSessionId) {
                              alert('No session ID available')
                              return
                            }
                            const { computeAnalytics } = await import('@/lib/api-client')
                            const result = await computeAnalytics(currentSessionId)
                            if (result.success) {
                              alert('Analytics computed! Refreshing...')
                              fetchAllAnalytics()
                            } else {
                              alert(result.error || 'Failed to compute analytics')
                            }
                          } catch (error) {
                            alert('Failed to compute analytics')
                          }
                        }}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        Compute Analytics Now
                      </button>
                    </div>
                  )}
                </div>
              )}
              {selectedReport === 'operational-metrics' && (
                <div>
                  {analyticsMetrics.length > 0 ? (
                    <WeeklySummaryChart data={transformToWeeklySummaryData(analyticsMetrics)} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No operational metrics data available.</p>
                      <button
                        onClick={async () => {
                          try {
                            const currentSessionId = localStorage.getItem('analyticsSessionId')
                            if (!currentSessionId) {
                              alert('No session ID available')
                              return
                            }
                            const { computeAnalytics } = await import('@/lib/api-client')
                            const result = await computeAnalytics(currentSessionId)
                            if (result.success) {
                              alert('Analytics computed! Refreshing...')
                              fetchAllAnalytics()
                              fetchAnalytics()
                            } else {
                              alert(result.error || 'Failed to compute analytics')
                            }
                          } catch (error) {
                            alert('Failed to compute analytics')
                          }
                        }}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        Compute Analytics Now
                      </button>
                    </div>
                  )}
                </div>
              )}
              {selectedReport === 'category-analytics' && (
                <div>
                  {categoryData.length > 0 ? (
                    <CategoryShareChart data={categoryData} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No category data available.</p>
                      <button
                        onClick={async () => {
                          try {
                            const currentSessionId = localStorage.getItem('analyticsSessionId')
                            if (!currentSessionId) {
                              alert('No session ID available')
                              return
                            }
                            const { computeAnalytics } = await import('@/lib/api-client')
                            const result = await computeAnalytics(currentSessionId)
                            if (result.success) {
                              alert('Analytics computed! Refreshing...')
                              fetchAllAnalytics()
                            } else {
                              alert(result.error || 'Failed to compute analytics')
                            }
                          } catch (error) {
                            alert('Failed to compute analytics')
                          }
                        }}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        Compute Analytics Now
                      </button>
                    </div>
                  )}
                </div>
              )}
              {selectedReport === 'cancellation-tracking' && (
                <div>
                  {cancellationData.length > 0 ? (
                    <CancellationChart data={cancellationData} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No cancellation data available.</p>
                      <button
                        onClick={async () => {
                          try {
                            const currentSessionId = localStorage.getItem('analyticsSessionId')
                            if (!currentSessionId) {
                              alert('No session ID available')
                              return
                            }
                            const { computeAnalytics } = await import('@/lib/api-client')
                            const result = await computeAnalytics(currentSessionId)
                            if (result.success) {
                              alert('Analytics computed! Refreshing...')
                              fetchAllAnalytics()
                            } else {
                              alert(result.error || 'Failed to compute analytics')
                            }
                          } catch (error) {
                            alert('Failed to compute analytics')
                          }
                        }}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        Compute Analytics Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Report Selection Grid */}
        {!selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-6">Analytics Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { id: 'ndr-analytics', name: 'NDR Analytics', description: 'NDR trends, conversion rates, and reason analysis', icon: '⚠️' },
                { id: 'state-performance', name: 'State Performance', description: 'State-wise delivery performance and order distribution', icon: '🗺️' },
                { id: 'operational-metrics', name: 'Operational Metrics', description: 'TAT metrics, order volumes, and delivery status breakdown', icon: '📊' },
                { id: 'category-analytics', name: 'Category Analytics', description: 'Category-wise order share and performance', icon: '📦' },
                { id: 'cancellation-tracking', name: 'Cancellation Tracking', description: 'Cancellation trends and reasons', icon: '❌' },
              ].map((report, index) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedReport(report.id)
                    router.push(`/admin/reports?report=${report.id}`)
                  }}
                >
                  <div className="text-4xl mb-3">{report.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{report.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{report.description}</p>
                  <button className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition-all">
                    View Report
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold text-white mb-6">Summary Statistics</h2>
          
          {loadingReports ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading reports...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Total Users', value: reportData?.totalUsers || 0, icon: '👥' },
                { title: 'Total Products', value: reportData?.totalProducts || 0, icon: '📦' },
                { title: 'Total Orders', value: reportData?.totalOrders || 0, icon: '🛒' },
                { title: 'Total Revenue', value: `$${reportData?.totalRevenue?.toLocaleString() || '0'}`, icon: '💰' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl">{stat.icon}</span>
                    <h3 className="text-gray-400 text-sm">{stat.title}</h3>
                  </div>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Channel Distribution */}
        {reportData && reportData.uniqueChannels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-6">Channel Distribution</h2>
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportData.uniqueChannels.map((channel, index) => (
                  <motion.div
                    key={channel}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{channel}</span>
                      <span className="text-gray-400 text-sm">Channel</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Shipping Analytics Section */}
        {!selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-6">Shipping Analytics Overview</h2>
            
            {loadingAnalytics ? (
              <div className="text-center py-12">
                <div className="text-gray-400">Loading analytics...</div>
              </div>
            ) : analyticsMetrics.length > 0 ? (
              <div className="space-y-6">
                {/* Weekly Summary Charts */}
                <WeeklySummaryChart data={transformToWeeklySummaryData(analyticsMetrics)} />

                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      title: 'Total Orders (12 weeks)',
                      value: analyticsMetrics.reduce((sum, m) => sum + m.total_orders, 0).toLocaleString(),
                      icon: '📦',
                    },
                    {
                      title: 'Total Revenue',
                      value: `₹${analyticsMetrics.reduce((sum, m) => sum + (m.total_order_value || 0), 0).toLocaleString()}`,
                      icon: '💰',
                    },
                    {
                      title: 'Avg NDR Rate',
                      value: `${(
                        analyticsMetrics.reduce((sum, m) => sum + (m.ndr_rate_percent || 0), 0) /
                        analyticsMetrics.length
                      ).toFixed(2)}%`,
                      icon: '⚠️',
                    },
                    {
                      title: 'Avg Delivery Rate',
                      value: `${(
                        (analyticsMetrics.reduce((sum, m) => sum + m.del_count, 0) /
                          analyticsMetrics.reduce((sum, m) => sum + m.total_orders, 0)) *
                        100
                      ).toFixed(2)}%`,
                      icon: '✅',
                    },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-4xl">{stat.icon}</span>
                        <h3 className="text-gray-400 text-sm">{stat.title}</h3>
                      </div>
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
                <p className="text-gray-400 text-center">
                  No analytics data available. Please sync data from the admin dashboard.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </main>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <ReportsPageContent />
    </Suspense>
  )
}
