import { db } from '../index'
import { users, emailVerifications } from '../schema'
import { eq } from 'drizzle-orm'
import { createUser } from './users'
import {
  createEmailVerification,
  findVerificationByToken,
  deleteVerificationByToken,
} from './email-verifications'

describe('email verification queries', () => {
  const testEmail = `test-verify-queries-${Date.now()}@example.com`
  const testToken = `test-token-${Date.now()}`
  let userId: string

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
    await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId))
    await db.delete(users).where(eq(users.id, userId))
  })

  it('createEmailVerification inserts a row', async () => {
    const verification = await createEmailVerification({
      userId,
      token: testToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    expect(verification.token).toBe(testToken)
    expect(verification.userId).toBe(userId)
  })

  it('findVerificationByToken returns the created row', async () => {
    const verification = await findVerificationByToken(testToken)
    expect(verification?.userId).toBe(userId)
  })

  it('findVerificationByToken returns null for an unknown token', async () => {
    const verification = await findVerificationByToken('does-not-exist')
    expect(verification).toBeNull()
  })

  it('deleteVerificationByToken removes the row', async () => {
    await deleteVerificationByToken(testToken)
    const verification = await findVerificationByToken(testToken)
    expect(verification).toBeNull()
  })
})
