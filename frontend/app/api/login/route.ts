import { NextRequest, NextResponse } from 'next/server'
import { proxyToPythonBackend } from '@/lib/api-proxy'

/**
 * POST /api/login
 * Proxy login request to Python backend
 */
export async function POST(request: NextRequest) {
  console.log('[Login API Route] Login request received')
  
  try {
    const body = await request.json()
    console.log('[Login API Route] Request body received:', { email: body.email, hasPassword: !!body.password })
    
    // Validate request body
    if (!body.email || !body.password) {
      console.log('[Login API Route] Validation failed: missing email or password')
      return NextResponse.json(
        { 
          success: false,
          error: 'Email and password are required' 
        },
        { status: 400 }
      )
    }
    
    console.log('[Login API Route] Proxying to Python backend...')
    const response = await proxyToPythonBackend('/api/login', {
      method: 'POST',
      body,
      timeout: 10000, // 10 second timeout for login
    })
    console.log('[Login API Route] Backend response received:', response.status)

    // Handle both success and error responses from backend
    const data = await response.json().catch(() => {
      // If response is not JSON, return a generic error
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }
    })
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error('Login error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    
    // Handle specific error types
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend server is not responding. Please ensure the Python backend is running on port 8000.' 
        },
        { status: 503 }
      )
    }
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('Cannot connect')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Cannot connect to backend server. Please ensure the Python backend is running. Check: python backend/run_backend.py' 
        },
        { status: 503 }
      )
    }
    
    if (error.message?.includes('fetch') || error.message?.includes('Network error')) {
      return NextResponse.json(
        { 
          success: false,
          error: `Network error: ${error.message}. Please check if the backend is running and accessible.` 
        },
        { status: 503 }
      )
    }
    
    if (error.message?.includes('Invalid backend URL')) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend configuration error. Please check your environment variables (NEXT_PUBLIC_PYTHON_API_URL).' 
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
