import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, students, classPromotionRuns, classPromotionLog } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { GET } from './route'

describe('GET /api/academic-planning/promotions', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns an empty payload when no school is active', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ pending: null, history: [] })
  })

  it('returns the pending run and separates confirmed history with promotedCount', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({ name: 'Student', class: '10', schoolId: school.id }).returning()

    const [pendingRun] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    const [confirmedRun] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2026-2027', boundaryDate: '2026-04-01', status: 'confirmed',
      previewCounts: { '9': { '10': 1 } }, confirmedAt: new Date(), confirmedBy: manager.id,
    }).returning()
    await db.insert(classPromotionLog).values({
      runId: confirmedRun.id, studentId: student.id, fromClass: '9', toClass: '10',
    })

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await GET()
      const body = await res.json()

      expect(body.pending.id).toBe(pendingRun.id)
      expect(body.history).toHaveLength(1)
      expect(body.history[0].id).toBe(confirmedRun.id)
      expect(body.history[0].promotedCount).toBe(1)
      expect(body.history[0].confirmedByName).toBe('Manager')
    } finally {
      await db.delete(classPromotionLog).where(eq(classPromotionLog.runId, confirmedRun.id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
