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
  const [readingFileId, setReadingFileId] = useState<string | null>(null)
  const [readingStatus, setReadingStatus] = useState<string>('')
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
      const { getStats } = await import('@/lib/api-client')
      const result = await getStats()
      
      if (result.success && result.data) {
        if (result.data.totalUsers !== undefined) {
          setTotalUsers(result.data.totalUsers.toString())
        }
      }
    } catch (error) {
      // Keep default value if fetch fails
    }
  }

  const fetchGoogleDriveFiles = async () => {
    setLoadingFiles(true)
    try {
      const { listGoogleDriveFiles } = await import('@/lib/api-client')
      const result = await listGoogleDriveFiles()
      
      if (result.success && result.data) {
        const files = result.data.files || []
        setGoogleDriveFiles(files)
        
        // Show helpful message if no files found
        if (files.length === 0 && result.data.message) {
          console.warn('Google Drive:', result.data.message)
          // Still mark as configured since auth is working
          setIsGoogleDriveConfigured(true)
        } else {
          setIsGoogleDriveConfigured(true)
        }
      } else {
        // Check if error is due to configuration
        const errorMessage = (result.error || '').toLowerCase()
        const isConfigError = 
          errorMessage.includes('not configured') ||
          errorMessage.includes('credentials') ||
          errorMessage.includes('decoder') ||
          errorMessage.includes('err_ossl') ||
          errorMessage.includes('unsupported') ||
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('invalid or expired') ||
          errorMessage.includes('refresh token')
        
        // If it's a configuration error or any error, mark as not configured
        setIsGoogleDriveConfigured(false)
        
        // Log the error for debugging
        console.error('Failed to fetch Google Drive files:', result.error)
      }
    } catch (error: any) {
      console.error('Error fetching Google Drive files:', error)
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      })
      setIsGoogleDriveConfigured(false)
      
      // Show user-friendly error message
      if (error.message?.includes('Failed to fetch')) {
        alert('Failed to connect to the server. Please ensure:\n' +
          '1. The frontend development server is running\n' +
          '2. The backend server is running at http://localhost:8000\n' +
          '3. Check the browser console for more details')
      }
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleGoogleDriveFileRead = async (fileId: string, fileName: string, sheetType: string = 'shipping') => {
    // Set loading state
    setReadingFileId(fileId)
    setReadingStatus(`Reading "${fileName}" from Google Drive...`)
    
    try {
      const { readGoogleDriveFile, computeAnalytics } = await import('@/lib/api-client')
      
      setReadingStatus(`Downloading file from Google Drive...`)
      const result = await readGoogleDriveFile(fileId, sheetType)

      if (!result.success) {
        setReadingStatus('')
        setReadingFileId(null)
        alert(result.error || 'Failed to read file from Google Drive')
        return
      }

      if (result.data) {
        const data = result.data
        // If it's a shipping file, compute analytics and redirect
        if (sheetType === 'shipping') {
          if (!data.sessionId) {
            console.error('Error: sessionId not found in response', data)
            setReadingStatus('')
            setReadingFileId(null)
            alert('Error: Session ID not returned from server. Please try again.')
            return
          }
          
          // Store session ID in localStorage
          localStorage.setItem('analyticsSessionId', data.sessionId)
          console.log('Session ID stored:', data.sessionId)
          
          setReadingStatus('Computing analytics...')
          
          // Compute analytics in background
          try {
            await computeAnalytics(data.sessionId)
          } catch (error) {
            console.error('Error computing analytics:', error)
            // Don't fail the request - analytics can be computed later
          }
          
          setReadingStatus('')
          setReadingFileId(null)
          
          // Show success message
          alert(
            `File "${data.fileName}" read successfully!\n\n` +
            `Total Rows: ${data.totalRows}\n` +
            `Original Rows: ${data.originalRows}\n` +
            `Duplicates Removed: ${data.duplicatesRemoved}\n` +
            `Total Columns: ${data.totalColumns}\n\n` +
            `✅ File parsed and saved\n` +
            `📊 Analytics computed`
          )
          
          // Redirect to analytics dashboard after successful parsing
          setTimeout(() => {
            router.push(`/admin/analytics?sessionId=${data.sessionId}`)
          }, 1000)
        } else {
          setReadingStatus('')
          setReadingFileId(null)
          
          alert(
            `File "${data.fileName}" read successfully!\n\n` +
            `Total Rows: ${data.totalRows}\n` +
            `Original Rows: ${data.originalRows}\n` +
            `Duplicates Removed: ${data.duplicatesRemoved}\n` +
            `Total Columns: ${data.totalColumns}`
          )
        }
      } else {
        console.error('Error: No data in response', result)
        setReadingStatus('')
        setReadingFileId(null)
        alert('Error: No data returned from server. Please try again.')
      }
    } catch (error: any) {
      setReadingStatus('')
      setReadingFileId(null)
      
      // Check if it's a timeout error
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        alert('Request timed out. The file might be too large. Please try again or contact support.')
      } else {
        alert(`An error occurred while reading the file: ${error.message || 'Unknown error'}`)
      }
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
                onClick={() => {
                  const storedSessionId = localStorage.getItem('analyticsSessionId')
                  if (storedSessionId) {
                    router.push(`/admin/analytics?sessionId=${storedSessionId}`)
                  } else {
                    alert('No session ID found. Please read a shipping file first.')
                  }
                }}
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

          {/* Loading overlay for file reading */}
          {readingFileId && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-black/90 backdrop-blur-lg rounded-xl p-8 border border-gray-700/50 max-w-md w-full mx-4"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <svg className="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-white text-lg font-semibold text-center">
                    {readingStatus || 'Processing file...'}
                  </p>
                  <p className="text-gray-400 text-sm text-center">
                    This may take a few moments for large files. Please don't close this page.
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {loadingFiles ? (
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <p className="text-gray-400">Loading files from Google Drive...</p>
            </div>
          ) : googleDriveFiles.length === 0 ? (
            <div className="bg-black/40 backdrop-blur-lg rounded-xl p-6 border border-gray-700/50">
              <p className="text-gray-400 mb-2">No Excel files found in Google Drive.</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Please check:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>The folder ID is correct (if configured in environment variables)</li>
                  <li>The folder contains Excel (.xlsx, .xls) or CSV files</li>
                  <li>Your Google account has access to the folder</li>
                  <li>The files are not in Trash</li>
                </ul>
                <p className="mt-2 text-gray-400">Check the backend console logs for more details.</p>
              </div>
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
                      disabled={readingFileId !== null}
                      className={`flex-1 px-3 py-2 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        readingFileId === file.id
                          ? 'bg-blue-500 cursor-wait'
                          : readingFileId !== null
                          ? 'bg-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {readingFileId === file.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Reading...
                        </>
                      ) : (
                        'Read as Shipping'
                      )}
                    </button>
                    <button
                      onClick={() => handleGoogleDriveFileRead(file.id, file.name, 'meta_campaign')}
                      disabled={readingFileId !== null}
                      className={`flex-1 px-3 py-2 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        readingFileId === file.id
                          ? 'bg-purple-500 cursor-wait'
                          : readingFileId !== null
                          ? 'bg-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      {readingFileId === file.id ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Reading...
                        </>
                      ) : (
                        'Read as Meta'
                      )}
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
