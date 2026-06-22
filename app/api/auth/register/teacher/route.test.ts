import { db } from '@/lib/db'
import { users, emailVerifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/mail', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { sendVerificationEmail } from '@/lib/mail'

describe('POST /api/auth/register/teacher', () => {
  const testEmail = `test-register-teacher-${Date.now()}@example.com`
  let createdUserId: string | undefined

  afterEach(async () => {
    if (createdUserId) {
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, createdUserId))
      await db.delete(users).where(eq(users.id, createdUserId))
      createdUserId = undefined
    }
  })

  it('creates a pending teacher account and sends a verification email', async () => {
    const req = new Request('http://localhost/api/auth/register/teacher', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Teacher',
        email: testEmail,
        password: 'password123',
        department: 'Physics',
      }),
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.message).toMatch(/check your email/i)
    expect(sendVerificationEmail).toHaveBeenCalledWith(testEmail, 'New Teacher', expect.any(String))

    const created = await db.select().from(users).where(eq(users.email, testEmail))
    expect(created[0].status).toBe('pending_verification')
    expect(created[0].role).toBe('teacher')
    createdUserId = created[0].id
  })

  it('rejects a password shorter than 8 characters', async () => {
    const req = new Request('http://localhost/api/auth/register/teacher', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', email: testEmail, password: 'short' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    const first = new Request('http://localhost/api/auth/register/teacher', {
      method: 'POST',
      body: JSON.stringify({ name: 'First', email: testEmail, password: 'password123' }),
    })
    const firstRes = await POST(first)
    createdUserId = (await db.select().from(users).where(eq(users.email, testEmail)))[0]?.id

    const second = new Request('http://localhost/api/auth/register/teacher', {
      method: 'POST',
      body: JSON.stringify({ name: 'Second', email: testEmail, password: 'password123' }),
    })
    const secondRes = await POST(second)
    expect(firstRes.status).toBe(201)
    expect(secondRes.status).toBe(409)
  })
})
