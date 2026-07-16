import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, updateUserPassword } from '@/lib/db/queries/users'
import {
  findLatestPasswordResetForUser,
  incrementPasswordResetAttempts,
  deletePasswordResetsForUser,
} from '@/lib/db/queries/password-resets'
import { isExpired } from '@/lib/tokens'

const MAX_ATTEMPTS = 5

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword } = await req.json()
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 })
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    const reset = await findLatestPasswordResetForUser(user.id)
    if (!reset) {
      return NextResponse.json({ error: 'No pending reset code found. Please request a new one.' }, { status: 400 })
    }

    if (isExpired(reset.expiresAt)) {
      await deletePasswordResetsForUser(user.id)
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 410 })
    }

    if (reset.attempts >= MAX_ATTEMPTS) {
      await deletePasswordResetsForUser(user.id)
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 })
    }

    if (reset.otp !== String(otp).trim()) {
      await incrementPasswordResetAttempts(reset.id)
      const remaining = MAX_ATTEMPTS - reset.attempts - 1
      return NextResponse.json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await updateUserPassword(user.id, hashedPassword)
    await deletePasswordResetsForUser(user.id)

    return NextResponse.json({ message: 'Password reset successfully. You can now log in.' }, { status: 200 })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
