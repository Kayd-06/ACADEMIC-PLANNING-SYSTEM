import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, classPromotionRuns } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req() {
  return new Request('http://localhost/api/academic-planning/promotions/x/dismiss', { method: 'POST' }) as any
}

describe('POST /api/academic-planning/promotions/[runId]/dismiss', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await POST(req(), { params: Promise.resolve({ runId: 'any' }) })
    expect(res.status).toBe(403)
  })

  it('marks a pending run as dismissed without touching any student data', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [student] = await db.insert(students).values({ name: 'Untouched', class: '9', schoolId: school.id }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending', previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('dismissed')

      const [unchangedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(unchangedStudent.class).toBe('9')
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('rejects dismissing a run that is not pending', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'dismissed', previewCounts: {},
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(400)
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
