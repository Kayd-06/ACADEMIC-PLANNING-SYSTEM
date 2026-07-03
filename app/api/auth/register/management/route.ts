import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, createUser } from '@/lib/db/queries/users'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: Request) {
  try {
    const { name, email, password, employeeId, inviteCode, joinCode } = await req.json()

    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json({ error: 'All fields including invite code are required' }, { status: 400 })
    }
    if (inviteCode !== process.env.MANAGEMENT_INVITE_CODE) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 403 })
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
    await createUser({
      name,
      email,
      password: hashedPassword,
      role: 'management',
      status: 'active',
      employeeId,
      schoolId,
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
