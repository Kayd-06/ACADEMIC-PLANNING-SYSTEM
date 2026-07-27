import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, adminSchools } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { PATCH } from './route'

function req(body: any) {
  return new Request('http://localhost/api/admin/schools/x', { method: 'PATCH', body: JSON.stringify(body) }) as any
}

describe('PATCH /api/admin/schools/[id] — academicYearStartMonth', () => {
  let managerId: string
  let schoolId: string

  beforeEach(async () => {
    const [manager] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}-${Math.random()}@test.com`, password: 'x', role: 'management',
    }).returning()
    managerId = manager.id
    const [school] = await db.insert(schools).values({ academicYearStartMonth: 4 }).returning()
    schoolId = school.id
    await db.insert(adminSchools).values({ userId: managerId, schoolId, role: 'owner' })
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: managerId, role: 'management' } })
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await db.delete(schools).where(eq(schools.id, schoolId))
    await db.delete(users).where(eq(users.id, managerId))
  })

  it('updates academicYearStartMonth', async () => {
    const res = await PATCH(req({ academicYearStartMonth: 7 }), { params: Promise.resolve({ id: schoolId }) })
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(7)
  })

  it('rejects an out-of-range academicYearStartMonth', async () => {
    const res = await PATCH(req({ academicYearStartMonth: 0 }), { params: Promise.resolve({ id: schoolId }) })
    expect(res.status).toBe(400)
  })
})
