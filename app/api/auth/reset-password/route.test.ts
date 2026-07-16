import { db } from '@/lib/db'
import { users, passwordResets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'
import { createPasswordReset } from '@/lib/db/queries/password-resets'
import bcrypt from 'bcryptjs'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST', body: JSON.stringify(body),
  }) as any
}

describe('POST /api/auth/reset-password', () => {
  let userId: string | undefined

  afterEach(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
  })

  async function makeUserWithReset(otp: string, expiresAt: Date, attempts = 0) {
    const email = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    const user = await createUser({ name: 'Reset User', email, password: 'old-hash', role: 'teacher', status: 'active' })
    userId = user.id
    await createPasswordReset({ userId: user.id, otp, expiresAt, attempts })
    return user
  }

  it('resets the password and deletes the code on a valid request', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))

    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/reset successfully/i)

    const [updated] = await db.select().from(users).where(eq(users.id, userId!))
    const matches = await bcrypt.compare('brand-new-password', updated.password)
    expect(matches).toBe(true)

    const remaining = await db.select().from(passwordResets).where(eq(passwordResets.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an incorrect code', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '000000', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(400)

    const [updated] = await db.select().from(users).where(eq(users.id, userId!))
    expect(updated.password).toBe('old-hash')
  })

  it('returns 404 for an email with no account', async () => {
    userId = undefined
    const res = await POST(req({ email: 'does-not-exist@example.com', otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(404)
  })

  it('returns 410 and deletes the code for an expired one', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() - 60 * 1000))
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(410)

    const remaining = await db.select().from(passwordResets).where(eq(passwordResets.userId, userId!))
    expect(remaining).toHaveLength(0)
  })

  it('returns 429 once attempts are exhausted', async () => {
    const user = await makeUserWithReset('123456', new Date(Date.now() + 10 * 60 * 1000), 5)
    const res = await POST(req({ email: user.email, otp: '123456', newPassword: 'brand-new-password' }))
    expect(res.status).toBe(429)
  })
})
