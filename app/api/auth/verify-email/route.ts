import { NextResponse } from 'next/server'
import { findVerificationByToken, deleteVerificationByToken } from '@/lib/db/queries/email-verifications'
import { updateUserStatus } from '@/lib/db/queries/users'
import { isTokenExpired } from '@/lib/tokens'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const verification = await findVerificationByToken(token)
    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid or already used verification link' },
        { status: 400 }
      )
    }

    if (isTokenExpired(verification.expiresAt)) {
      await deleteVerificationByToken(token)
      return NextResponse.json(
        { error: 'Verification link has expired. Please sign up again.' },
        { status: 410 }
      )
    }

    await updateUserStatus(verification.userId, 'active')
    await deleteVerificationByToken(token)

    return NextResponse.json(
      { message: 'Email verified successfully. You can now log in.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
