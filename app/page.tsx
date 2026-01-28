'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Scene3D from './components/Scene3D'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        setIsLoading(false)
        return
      }

      if (data.success && data.user) {
        // Store user data in localStorage
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Redirect based on role
        if (data.user.role === 'admin') {
          router.push('/admin')
        } else {
          // Handle other roles here when you create their dashboards
          setError('Dashboard not available for this role')
          setIsLoading(false)
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900" style={{ overflow: 'hidden' }}>
      {/* 3D Background Scene */}
      <Scene3D />
      
      {/* Overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-md px-6"
        >
          {/* Moving Square Above Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mx-auto mb-8 w-24 h-24 flex items-center justify-center relative"
          >
            <motion.div
              animate={{
                x: [-40, 40, -40],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-800 shadow-2xl"
              style={{
                boxShadow: '0 0 30px rgba(107, 114, 128, 0.5), 0 0 60px rgba(75, 85, 99, 0.3)',
              }}
            />
          </motion.div>

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="bg-black/40 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-gray-700/50"
          >
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-3xl font-bold text-white mb-8 text-center"
            >
              Welcome Back
            </motion.h2>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                />
              </motion.div>

              {/* Password Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                />
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Login Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  onHoverStart={() => !isLoading && setIsHovered(true)}
                  onHoverEnd={() => setIsHovered(false)}
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                  className="relative w-full px-6 py-3 text-lg font-semibold text-white bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg overflow-hidden shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    boxShadow: isHovered && !isLoading
                      ? '0 0 30px rgba(107, 114, 128, 0.8), 0 0 60px rgba(75, 85, 99, 0.6)' 
                      : '0 0 15px rgba(107, 114, 128, 0.5)',
                  }}
                >
                  <motion.span
                    className="relative z-10"
                    animate={{
                      textShadow: isHovered && !isLoading
                        ? '0 0 10px rgba(255, 255, 255, 0.8)' 
                        : '0 0 5px rgba(255, 255, 255, 0.5)',
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {isLoading ? 'Logging in...' : 'Login'}
                  </motion.span>
                  
                  {/* Animated background gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-600"
                    animate={{
                      background: isHovered
                        ? [
                            'linear-gradient(90deg, #4b5563, #6b7280)',
                            'linear-gradient(90deg, #6b7280, #4b5563)',
                            'linear-gradient(90deg, #4b5563, #6b7280)',
                          ]
                        : 'linear-gradient(90deg, #6b7280, #4b5563)',
                    }}
                    transition={{
                      duration: 2,
                      repeat: isHovered ? Infinity : 0,
                      ease: 'linear',
                    }}
                  />
                  
                  {/* Shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{
                      x: isHovered ? ['-100%', '200%'] : '-100%',
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: isHovered ? Infinity : 0,
                      ease: 'linear',
                    }}
                    style={{ width: '50%' }}
                  />
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
