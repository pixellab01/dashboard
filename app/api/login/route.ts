import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user in MongoDB
    const client = await clientPromise
    const db = client.db('dashboard')
    const usersCollection = db.collection('users')

    const user = await usersCollection.findOne({ email: email })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Simple password comparison (in production, use bcrypt or similar)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Return user data (excluding password)
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        success: true,
        user: {
          ...userWithoutPassword,
          id: user._id.toString(),
        },
        message: 'Login successful'
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
