import { db } from '@/lib/db'
import { users, emailVerifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from '@/lib/db/queries/users'
import { createEmailVerification } from '@/lib/db/queries/email-verifications'
import { GET } from './route'

describe('GET /api/auth/verify-email', () => {
  let userId: string

  afterEach(async () => {
    await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId))
    await db.delete(users).where(eq(users.id, userId))
  })

  async function makePendingUserWithToken(token: string, expiresAt: Date) {
    const user = await createUser({
      name: 'Pending User',
      email: `test-verify-${token}@example.com`,
      password: 'hashed',
      role: 'teacher',
      status: 'pending_verification',
    })
    userId = user.id
    await createEmailVerification({ userId: user.id, token, expiresAt })
    return user
  }

  it('activates the user and deletes the token on a valid request', async () => {
    const token = `valid-token-${Date.now()}`
    await makePendingUserWithToken(token, new Date(Date.now() + 60 * 60 * 1000))

    const req = new Request(`http://localhost/api/auth/verify-email?token=${token}`)
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toMatch(/verified successfully/i)

    const updatedUser = (await db.select().from(users).where(eq(users.id, userId)))[0]
    expect(updatedUser.status).toBe('active')

    const remainingTokens = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token))
    expect(remainingTokens).toHaveLength(0)
  })

  it('returns 400 for a token that does not exist', async () => {
    userId = '00000000-0000-0000-0000-000000000000'
    const req = new Request('http://localhost/api/auth/verify-email?token=does-not-exist')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 410 and deletes the token for an expired link', async () => {
    const token = `expired-token-${Date.now()}`
    await makePendingUserWithToken(token, new Date(Date.now() - 60 * 60 * 1000))

    const req = new Request(`http://localhost/api/auth/verify-email?token=${token}`)
    const res = await GET(req)
    expect(res.status).toBe(410)

    const remainingTokens = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.token, token))
    expect(remainingTokens).toHaveLength(0)
  })
})
