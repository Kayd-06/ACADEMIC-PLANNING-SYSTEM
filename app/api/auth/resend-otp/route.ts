import { NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/db/queries/users'
import {
  createEmailVerification,
  findLatestVerificationForUser,
  deleteVerificationsForUser,
} from '@/lib/db/queries/email-verifications'
import { generateOtp, getExpiry } from '@/lib/tokens'
import { sendVerificationEmail } from '@/lib/mail'

const RESEND_COOLDOWN_MS = 30 * 1000

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }
    if (user.status === 'active') {
      return NextResponse.json({ message: 'Email already verified. You can now log in.' }, { status: 200 })
    }

    const previous = await findLatestVerificationForUser(user.id)
    if (previous && Date.now() - new Date(previous.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(previous.createdAt).getTime())) / 1000)
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code.` }, { status: 429 })
    }

    await deleteVerificationsForUser(user.id)
    const otp = generateOtp()
    await createEmailVerification({ userId: user.id, otp, expiresAt: getExpiry(10) })
    await sendVerificationEmail(email, user.name, otp)

    return NextResponse.json({ message: 'A new verification code has been sent.' }, { status: 200 })
  } catch (error) {
    console.error('Resend OTP error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
