import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/admin/schools', { method: 'POST', body: JSON.stringify(body) }) as any
}

describe('POST /api/admin/schools — academicYearStartMonth', () => {
  let managerId: string

  beforeEach(async () => {
    const [manager] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}-${Math.random()}@test.com`, password: 'x', role: 'management',
    }).returning()
    managerId = manager.id
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: managerId, role: 'management', email: manager.email } })
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await db.delete(users).where(eq(users.id, managerId))
  })

  it('defaults academicYearStartMonth to 4 when not provided', async () => {
    const res = await POST(req({ name: 'No Month School' }))
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(4)
    await db.delete(schools).where(eq(schools.id, body.id))
  })

  it('persists a valid academicYearStartMonth', async () => {
    const res = await POST(req({ name: 'June Start School', academicYearStartMonth: 6 }))
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(6)
    await db.delete(schools).where(eq(schools.id, body.id))
  })

  it('rejects an out-of-range academicYearStartMonth', async () => {
    const res = await POST(req({ name: 'Bad Month School', academicYearStartMonth: 13 }))
    expect(res.status).toBe(400)
  })
})
