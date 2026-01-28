'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface User {
  email: string
  role: string
  name: string
}


export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState<string>('0')
  const [googleDriveFiles, setGoogleDriveFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isGoogleDriveConfigured, setIsGoogleDriveConfigured] = useState<boolean>(false)
  const router = useRouter()

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
    fetchStats()
    fetchGoogleDriveFiles()
    setIsLoading(false)
  }, [router])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      const data = await response.json()
      
      if (data.success) {
        if (data.totalUsers !== undefined) {
          setTotalUsers(data.totalUsers.toString())
        }
      }
    } catch (error) {
      // Keep default value if fetch fails
    }
  }

  const fetchGoogleDriveFiles = async () => {
    setLoadingFiles(true)
    try {
      const response = await fetch('/api/google-drive/files')
      const data = await response.json()
      
      if (data.success) {
        setGoogleDriveFiles(data.files || [])
        setIsGoogleDriveConfigured(true)
      } else {
        // Check if error is due to configuration
        const errorMessage = (data.error || '').toLowerCase()
        const isConfigError = 
          data.isConfigurationError ||
          errorMessage.includes('not configured') ||
          errorMessage.includes('credentials') ||
          errorMessage.includes('decoder') ||
          errorMessage.includes('err_ossl') ||
          errorMessage.includes('unsupported') ||
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('invalid or expired') ||
          errorMessage.includes('refresh token') ||
          !response.ok // If response is not ok, treat as configuration issue
        
        // If it's a configuration error or any error, mark as not configured
        setIsGoogleDriveConfigured(false)
      }
    } catch (error) {
      console.error('Error fetching Google Drive files:', error)
      setIsGoogleDriveConfigured(false)
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleGoogleDriveFileRead = async (fileId: string, fileName: string, sheetType: string = 'shipping') => {
    try {
      const loadingMessage = `Reading "${fileName}" from Google Drive...\nPlease wait, this may take a moment.`
      alert(loadingMessage)

      const response = await fetch('/api/google-drive/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, sheetType }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to read file from Google Drive')
        return
      }

      if (data.success) {
        // If it's a shipping file, compute analytics and redirect
        if (sheetType === 'shipping' && data.sessionId) {
          // Store session ID in localStorage
          localStorage.setItem('analyticsSessionId', data.sessionId)
          
          // Compute analytics in background
          try {
            await fetch('/api/analytics/compute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: data.sessionId }),
            })
          } catch (error) {
            console.error('Error computing analytics:', error)
          }
          
          let message = `File "${data.fileName}" read successfully from Google Drive!\n\n` +
            `Total Rows: ${data.totalRows}\n` +
            `Original Rows: ${data.originalRows}\n` +
            `Duplicates Removed: ${data.duplicatesRemoved}\n` +
            `Total Columns: ${data.totalColumns}\n\n` +
            `✅ File parsed and saved to Redis (30 min TTL)\n` +
            `📊 Computing analytics...`
          
          alert(message)
          
          // Redirect to analytics dashboard after successful parsing
          setTimeout(() => {
            router.push(`/admin/analytics?sessionId=${data.sessionId}`)
          }, 1500)
        } else {
          let message = `File "${data.fileName}" read successfully from Google Drive!\n\n` +
            `Total Rows: ${data.totalRows}\n` +
            `Original Rows: ${data.originalRows}\n` +
            `Duplicates Removed: ${data.duplicatesRemoved}\n` +
            `Total Columns: ${data.totalColumns}\n\n` +
            `✅ File parsed successfully`
          
          alert(message)
        }
      }
    } catch (error) {
      alert('An error occurred while reading the file from Google Drive. Please try again.')
    }
  }


  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
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
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-2xl font-bold text-white mb-1">
                Welcome, {user?.name || 'Admin'}!
              </h1>
              <p className="text-gray-400">Manage your dashboard and settings</p>
            </motion.div>
            <motion.button
              onClick={handleLogout}
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
        {/* Actions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Google Drive Files</h2>
            <div className="flex gap-2">
              <motion.button
                onClick={() => router.push('/admin/analytics')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                View Analytics
              </motion.button>
              <motion.button
                onClick={fetchGoogleDriveFiles}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Files
              </motion.button>
            </div>
          </div>

          {loadingFiles ? (
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <p className="text-gray-400">Loading files from Google Drive...</p>
            </div>
          ) : googleDriveFiles.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <p className="text-gray-400">No Excel files found in Google Drive. Please check your Google Drive folder configuration.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {googleDriveFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-gray-700/50 hover:border-gray-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{file.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleGoogleDriveFileRead(file.id, file.name, 'shipping')}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
                    >
                      Read as Shipping
                    </button>
                    <button
                      onClick={() => handleGoogleDriveFileRead(file.id, file.name, 'meta_campaign')}
                      className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-all"
                    >
                      Read as Meta
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[
            { title: 'Total Users', value: totalUsers, change: '+12%' },
            { 
              title: 'Google Drive Files', 
              value: googleDriveFiles.length.toString(), 
              change: isGoogleDriveConfigured ? 'Live' : 'Not Configured',
              changeColor: isGoogleDriveConfigured ? 'text-green-400' : 'text-gray-400'
            },
            { title: 'Data Source', value: 'Google Drive', change: 'Direct' },
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <h3 className="text-gray-400 text-sm mb-2">{stat.title}</h3>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <span className={`text-sm ${stat.changeColor || 'text-green-400'}`}>{stat.change}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Analytics Dashboard Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white">Analytics Dashboard</h2>
            <p className="text-gray-400 mt-2">View comprehensive analytics and reports</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* NDR Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">NDR Analytics</h3>
                    <p className="text-gray-400 text-sm">NDR trends & conversion</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports?report=ndr-analytics')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-lg font-semibold transition-all"
              >
                View Reports
              </button>
            </motion.div>

            {/* State Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">State Performance</h3>
                    <p className="text-gray-400 text-sm">State-wise delivery metrics</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports?report=state-performance')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition-all"
              >
                View Reports
              </button>
            </motion.div>

            {/* Operational Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Operational Metrics</h3>
                    <p className="text-gray-400 text-sm">TAT, volumes & status</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports?report=operational-metrics')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-semibold transition-all"
              >
                View Reports
              </button>
            </motion.div>

            {/* Category Analytics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Category Analytics</h3>
                    <p className="text-gray-400 text-sm">Category-wise insights</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports?report=category-analytics')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all"
              >
                View Reports
              </button>
            </motion.div>

            {/* Cancellation Tracking */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Cancellation Tracking</h3>
                    <p className="text-gray-400 text-sm">Cancellation trends & reasons</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports?report=cancellation-tracking')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition-all"
              >
                View Reports
              </button>
            </motion.div>

            {/* Summary Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Summary Dashboard</h3>
                    <p className="text-gray-400 text-sm">Complete overview</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/admin/reports')}
                className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg font-semibold transition-all"
              >
                View All Reports
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
          >
            <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { action: 'New user registered', time: '2 minutes ago' },
                { action: 'Order #1234 completed', time: '15 minutes ago' },
                { action: 'Product updated', time: '1 hour ago' },
                { action: 'Payment received', time: '2 hours ago' },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                >
                  <span className="text-gray-300">{activity.action}</span>
                  <span className="text-gray-500 text-sm">{activity.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* User Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-6 bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50"
        >
          <h3 className="text-xl font-bold text-white mb-4">User Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Email</p>
              <p className="text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Role</p>
              <p className="text-white capitalize">{user?.role}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Name</p>
              <p className="text-white">{user?.name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Status</p>
              <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">
                Active
              </span>
            </div>
          </div>
        </motion.div>
      </main>

    </div>
  )
}
