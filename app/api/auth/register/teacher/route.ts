import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, createUser } from '@/lib/db/queries/users'
import { createEmailVerification } from '@/lib/db/queries/email-verifications'
import { generateToken, getTokenExpiry } from '@/lib/tokens'
import { sendVerificationEmail } from '@/lib/mail'

export async function POST(req: Request) {
  try {
    const { name, email, password, department } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await createUser({
      name,
      email,
      password: hashedPassword,
      role: 'teacher',
      status: 'pending_verification',
      department,
    })

    const token = generateToken()
    await createEmailVerification({
      userId: user.id,
      token,
      expiresAt: getTokenExpiry(24),
    })

    await sendVerificationEmail(email, name, token)

    return NextResponse.json(
      { message: 'Account created. Please check your email to complete verification.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Teacher registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
