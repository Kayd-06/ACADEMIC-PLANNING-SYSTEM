import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import EmailVerification from '@/models/EmailVerification'
import { isTokenExpired } from '@/lib/tokens'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await connectDB()

    const verification = await EmailVerification.findOne({ token })
    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid or already used verification link' },
        { status: 400 }
      )
    }

    if (isTokenExpired(verification.expiresAt)) {
      await EmailVerification.deleteOne({ token })
      return NextResponse.json(
        { error: 'Verification link has expired. Please sign up again.' },
        { status: 410 }
      )
    }

    await User.findByIdAndUpdate(verification.userId, { status: 'active' })
    await EmailVerification.deleteOne({ token })

    return NextResponse.json(
      { message: 'Email verified successfully. You can now log in.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
