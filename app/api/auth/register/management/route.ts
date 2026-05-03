import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req: Request) {
  try {
    const { name, email, password, employeeId, inviteCode } = await req.json()

    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json(
        { error: 'All fields including invite code are required' },
        { status: 400 }
      )
    }

    if (inviteCode !== process.env.MANAGEMENT_INVITE_CODE) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    await connectDB()

    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'management',
      status: 'active',
      employeeId,
    })

    return NextResponse.json(
      { message: 'Management account created successfully. You can now log in.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Management registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
