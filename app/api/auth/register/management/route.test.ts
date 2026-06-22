import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { POST } from './route'

describe('POST /api/auth/register/management', () => {
  const testEmail = `test-register-mgmt-${Date.now()}@example.com`
  const validInviteCode = process.env.MANAGEMENT_INVITE_CODE ?? 'test-invite-code'
  let createdUserId: string | undefined

  beforeAll(() => {
    process.env.MANAGEMENT_INVITE_CODE = validInviteCode
  })

  afterEach(async () => {
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId))
      createdUserId = undefined
    }
  })

  it('creates an active management account when the invite code is correct', async () => {
    const req = new Request('http://localhost/api/auth/register/management', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Manager',
        email: testEmail,
        password: 'password123',
        employeeId: 'EMP-001',
        inviteCode: validInviteCode,
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.message).toMatch(/created successfully/i)

    const created = await db.select().from(users).where(eq(users.email, testEmail))
    expect(created[0].status).toBe('active')
    expect(created[0].role).toBe('management')
    createdUserId = created[0].id
  })

  it('rejects an incorrect invite code', async () => {
    const req = new Request('http://localhost/api/auth/register/management', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Manager',
        email: testEmail,
        password: 'password123',
        inviteCode: 'wrong-code',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
