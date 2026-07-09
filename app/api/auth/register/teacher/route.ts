import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, createUser } from '@/lib/db/queries/users'
import { createEmailVerification } from '@/lib/db/queries/email-verifications'
import { ensureFacultyRecord } from '@/lib/db/queries/faculty'
import { generateToken, getTokenExpiry } from '@/lib/tokens'
import { sendVerificationEmail } from '@/lib/mail'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  try {
    const { name, email, password, department, joinCode } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Resolve school from join code
    let schoolId: string | null = null
    if (joinCode) {
      const [school] = await db.select().from(schools).where(eq(schools.joinCode, joinCode.trim().toUpperCase()))
      if (!school) return NextResponse.json({ error: 'Invalid school join code' }, { status: 400 })
      if (!school.isActive) return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
      schoolId = school.id
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await createUser({
      name,
      email,
      password: hashedPassword,
      role: 'teacher',
      status: 'pending_verification',
      department,
      schoolId,
    })

    // Surface the teacher in management's Faculty Directory right away —
    // otherwise they're a login with no visible staff record until an admin
    // manually re-adds them via "Add Faculty".
    if (schoolId) {
      await ensureFacultyRecord({ userId: user.id, schoolId, name, email, department })
    }

    const token = generateToken()
    await createEmailVerification({ userId: user.id, token, expiresAt: getTokenExpiry(24) })
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
