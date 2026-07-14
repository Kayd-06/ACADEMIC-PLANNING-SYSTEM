import { db } from '../index'
import { users, emailVerifications } from '../schema'
import { eq } from 'drizzle-orm'
import { createUser } from './users'
import {
  createEmailVerification,
  findLatestVerificationForUser,
  incrementVerificationAttempts,
  deleteVerificationsForUser,
} from './email-verifications'

describe('email verification queries', () => {
  const testEmail = `test-verify-queries-${Date.now()}@example.com`
  const testOtp = '123456'
  let userId: string | undefined

  beforeAll(async () => {
    const user = await createUser({
      name: 'Test Teacher',
      email: testEmail,
      password: 'hashed-password',
      role: 'teacher',
      status: 'pending_verification',
    })
    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
  })

  it('createEmailVerification inserts a row', async () => {
    const verification = await createEmailVerification({
      userId,
      otp: testOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    expect(verification.otp).toBe(testOtp)
    expect(verification.userId).toBe(userId)
    expect(verification.attempts).toBe(0)
  })

  it('findLatestVerificationForUser returns the most recently created row', async () => {
    const verification = await findLatestVerificationForUser(userId)
    expect(verification?.userId).toBe(userId)
    expect(verification?.otp).toBe(testOtp)
  })

  it('findLatestVerificationForUser returns null for a user with no verification', async () => {
    const verification = await findLatestVerificationForUser('00000000-0000-0000-0000-000000000000')
    expect(verification).toBeNull()
  })

  it('incrementVerificationAttempts bumps the attempt count', async () => {
    const before = await findLatestVerificationForUser(userId)
    await incrementVerificationAttempts(before!.id)
    const after = await findLatestVerificationForUser(userId)
    expect(after?.attempts).toBe((before?.attempts ?? 0) + 1)
  })

  it('deleteVerificationsForUser removes all rows for the user', async () => {
    await deleteVerificationsForUser(userId)
    const verification = await findLatestVerificationForUser(userId)
    expect(verification).toBeNull()
  })
})
