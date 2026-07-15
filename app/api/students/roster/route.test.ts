import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: jest.fn((session: any) => session?.user?.schoolId || null),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/students/roster') as any
}

const createdStudentIds: string[] = []

describe('GET /api/students/roster', () => {
  beforeEach(() => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: '11111111-1111-1111-1111-111111111111', schoolId: null, role: 'teacher' } })
  })
  afterEach(async () => {
    if (createdStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, createdStudentIds))
      createdStudentIds.length = 0
    }
  })

  it('returns real program and batch values when set', async () => {
    const [inserted] = await db.insert(students).values({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning', class: '11 - A', section: 'A' }).returning()
    createdStudentIds.push(inserted.id)

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    const found = body.find((s: any) => s._id === inserted.id)
    expect(found.program).toBe('JEE 2026')
    expect(found.batch).toBe('Morning')
  })

  it('falls back to Unassigned when program and batch are empty', async () => {
    const [inserted] = await db.insert(students).values({ name: 'No Program' }).returning()
    createdStudentIds.push(inserted.id)

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    const found = body.find((s: any) => s._id === inserted.id)
    expect(found.program).toBe('Unassigned')
    expect(found.batch).toBe('Unassigned')
  })
})
