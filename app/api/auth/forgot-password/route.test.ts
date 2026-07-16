import { db } from '@/lib/db'
import { users, passwordResets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'

jest.mock('@/lib/mail', () => ({ sendPasswordResetEmail: jest.fn() }))

import { sendPasswordResetEmail } from '@/lib/mail'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST', body: JSON.stringify(body),
  }) as any
}

describe('POST /api/auth/forgot-password', () => {
  let userId: string | undefined

  afterEach(async () => {
    if (userId) {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(users).where(eq(users.id, userId))
      userId = undefined
    }
    jest.clearAllMocks()
  })

  it('returns the generic message and sends an email for a real account', async () => {
    const email = `forgot-${Date.now()}@example.com`
    const user = await createUser({ name: 'Test User', email, password: 'x', role: 'teacher', status: 'active' })
    userId = user.id

    const res = await POST(req({ email }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/if an account/i)
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)

    const [reset] = await db.select().from(passwordResets).where(eq(passwordResets.userId, user.id))
    expect(reset.otp).toHaveLength(6)
  })

  it('returns the same generic message for an unknown email, without sending anything', async () => {
    const res = await POST(req({ email: 'nobody-here@example.com' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.message).toMatch(/if an account/i)
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('enforces the 30s resend cooldown for a real account', async () => {
    const email = `forgot-${Date.now()}@example.com`
    const user = await createUser({ name: 'Test User', email, password: 'x', role: 'teacher', status: 'active' })
    userId = user.id

    await POST(req({ email }))
    const res = await POST(req({ email }))
    expect(res.status).toBe(429)
  })
})
