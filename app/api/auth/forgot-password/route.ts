import { NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/db/queries/users'
import {
  createPasswordReset,
  findLatestPasswordResetForUser,
  deletePasswordResetsForUser,
} from '@/lib/db/queries/password-resets'
import { generateOtp, getExpiry } from '@/lib/tokens'
import { sendPasswordResetEmail } from '@/lib/mail'

const RESEND_COOLDOWN_MS = 30 * 1000
const GENERIC_MESSAGE = 'If an account exists for that email, a reset code has been sent.'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      // Never reveal whether the account exists.
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
    }

    const previous = await findLatestPasswordResetForUser(user.id)
    if (previous && Date.now() - new Date(previous.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(previous.createdAt).getTime())) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code.` }, { status: 429 })
    }

    await deletePasswordResetsForUser(user.id)
    const otp = generateOtp()
    await createPasswordReset({ userId: user.id, otp, expiresAt: getExpiry(10) })
    await sendPasswordResetEmail(email, user.name, otp)

    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
