import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db('dashboard')

    // Get total users from users collection (MongoDB is now only for user data)
    const usersCollection = db.collection('users')
    const totalUsers = await usersCollection.countDocuments({})

    return NextResponse.json(
      {
        success: true,
        totalUsers: totalUsers,
        message: 'Excel data is now read directly from Google Drive, not stored in MongoDB',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
