import { db } from '@/lib/db'
import { users, emailVerifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'
import { createEmailVerification } from '@/lib/db/queries/email-verifications'
import { POST } from './route'

describe('POST /api/auth/verify-email', () => {
  let userId: string | undefined

  afterEach(async () => {
    if (userId) {
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId!))
      await db.delete(users).where(eq(users.id, userId!))
      userId = undefined
    }
  })

  async function makePendingUserWithOtp(otp: string, expiresAt: Date, attempts = 0) {
    const email = `test-verify-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const user = await createUser({
      name: 'Pending User',
      email,
      password: 'hashed',
      role: 'teacher',
      status: 'pending_verification',
    })
    userId = user.id
    await createEmailVerification({ userId: user.id, otp, expiresAt, attempts })
    return user
  }

  it('activates the user and deletes the code on a valid request', async () => {
    const user = await makePendingUserWithOtp('123456', new Date(Date.now() + 10 * 60 * 1000))

    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, otp: '123456' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toMatch(/verified successfully/i)

    const updatedUser = (await db.select().from(users).where(eq(users.id, userId!)))[0]
    expect(updatedUser.status).toBe('active')

    const remaining = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('returns 400 for an incorrect code', async () => {
    const user = await makePendingUserWithOtp('123456', new Date(Date.now() + 10 * 60 * 1000))

    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, otp: '000000' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)

    const updatedUser = (await db.select().from(users).where(eq(users.id, userId!)))[0]
    expect(updatedUser.status).toBe('pending_verification')
  })

  it('returns 404 for an email with no account', async () => {
    userId = '00000000-0000-0000-0000-000000000000'
    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'does-not-exist@example.com', otp: '123456' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 410 and deletes the code for an expired one', async () => {
    const user = await makePendingUserWithOtp('123456', new Date(Date.now() - 60 * 1000))

    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, otp: '123456' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(410)

    const remaining = await db.select().from(emailVerifications).where(eq(emailVerifications.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('returns 429 once attempts are exhausted', async () => {
    const user = await makePendingUserWithOtp('123456', new Date(Date.now() + 10 * 60 * 1000), 5)

    const req = new Request('http://localhost/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: user.email, otp: '123456' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
