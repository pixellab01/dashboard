/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

// Python Backend API URL
export const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000'

// Next.js API URL (for endpoints not yet migrated to Python)
export const NEXT_API_URL = process.env.NEXT_PUBLIC_API_URL || ''

/**
 * Get the full API URL for Python backend endpoints
 */
export function getPythonApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `${PYTHON_API_URL}/${cleanPath}`
}

/**
 * Get the full API URL for Next.js endpoints
 */
export function getNextApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return NEXT_API_URL ? `${NEXT_API_URL}/${cleanPath}` : `/${cleanPath}`
}

/**
 * Check if we should use Python backend for analytics endpoints
 */
export const USE_PYTHON_BACKEND = process.env.NEXT_PUBLIC_USE_PYTHON_BACKEND !== 'false'
