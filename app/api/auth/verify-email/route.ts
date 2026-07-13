import { NextResponse } from 'next/server'
import { findUserByEmail, updateUserStatus } from '@/lib/db/queries/users'
import {
  findLatestVerificationForUser,
  incrementVerificationAttempts,
  deleteVerificationsForUser,
} from '@/lib/db/queries/email-verifications'
import { isExpired } from '@/lib/tokens'

const MAX_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json()
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }
    if (user.status === 'active') {
      return NextResponse.json({ message: 'Email already verified. You can now log in.' }, { status: 200 })
    }

    const verification = await findLatestVerificationForUser(user.id)
    if (!verification) {
      return NextResponse.json({ error: 'No pending verification code found. Please request a new one.' }, { status: 400 })
    }

    if (isExpired(verification.expiresAt)) {
      await deleteVerificationsForUser(user.id)
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 410 })
    }

    if (verification.attempts >= MAX_ATTEMPTS) {
      await deleteVerificationsForUser(user.id)
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 })
    }

    if (verification.otp !== String(otp).trim()) {
      await incrementVerificationAttempts(verification.id)
      const remaining = MAX_ATTEMPTS - verification.attempts - 1
      return NextResponse.json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }, { status: 400 })
    }

    await updateUserStatus(user.id, 'active')
    await deleteVerificationsForUser(user.id)

    return NextResponse.json({ message: 'Email verified successfully. You can now log in.' }, { status: 200 })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
