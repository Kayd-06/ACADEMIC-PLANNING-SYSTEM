import { db } from '../index'
import { users, passwordResets } from '../schema'
import { eq } from 'drizzle-orm'
import { createUser } from './users'
import {
  createPasswordReset,
  findLatestPasswordResetForUser,
  incrementPasswordResetAttempts,
  deletePasswordResetsForUser,
} from './password-resets'

describe('password reset queries', () => {
  const testEmail = `test-reset-queries-${Date.now()}@example.com`
  const testOtp = '654321'
  let userId: string | undefined

  beforeAll(async () => {
    const user = await createUser({
      name: 'Test Teacher', email: testEmail, password: 'hashed-password', role: 'teacher', status: 'active',
    })
    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
  })

  it('createPasswordReset inserts a row', async () => {
    const reset = await createPasswordReset({
      userId: userId!, otp: testOtp, expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
    expect(reset.otp).toBe(testOtp)
    expect(reset.userId).toBe(userId)
    expect(reset.attempts).toBe(0)
  })

  it('findLatestPasswordResetForUser returns the most recently created row', async () => {
    const reset = await findLatestPasswordResetForUser(userId!)
    expect(reset?.userId).toBe(userId)
    expect(reset?.otp).toBe(testOtp)
  })

  it('findLatestPasswordResetForUser returns null for a user with no reset', async () => {
    const reset = await findLatestPasswordResetForUser('00000000-0000-0000-0000-000000000000')
    expect(reset).toBeNull()
  })

  it('incrementPasswordResetAttempts bumps the attempt count', async () => {
    const before = await findLatestPasswordResetForUser(userId!)
    await incrementPasswordResetAttempts(before!.id)
    const after = await findLatestPasswordResetForUser(userId!)
    expect(after?.attempts).toBe((before?.attempts ?? 0) + 1)
  })

  it('deletePasswordResetsForUser removes all rows for the user', async () => {
    await deletePasswordResetsForUser(userId!)
    const reset = await findLatestPasswordResetForUser(userId!)
    expect(reset).toBeNull()
  })
})
