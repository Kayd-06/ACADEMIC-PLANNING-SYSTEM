import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, students, classPromotionRuns, notifications } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

describe('POST /api/academic-planning/promotions/check', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await POST()
    expect(res.status).toBe(403)
  })

  it('returns 400 when no school is active', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const res = await POST()
    expect(res.status).toBe(400)
  })

  it('creates a pending run and notification on first call, and a no-op on retry', async () => {
    const [school] = await db.insert(schools).values({ academicYearStartMonth: 4 }).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({ name: 'Student', class: '10', schoolId: school.id }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

      const first = await POST()
      expect(first.status).toBe(200)
      const firstBody = await first.json()
      expect(firstBody.created).toBe(true)

      const runs = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
      expect(runs).toHaveLength(1)
      expect(runs[0].status).toBe('pending')

      const notifs = await db.select().from(notifications).where(eq(notifications.userId, manager.id))
      expect(notifs).toHaveLength(1)

      const second = await POST()
      const secondBody = await second.json()
      expect(secondBody.created).toBe(false)

      const runsAfterRetry = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
      expect(runsAfterRetry).toHaveLength(1)
    } finally {
      await db.delete(notifications).where(eq(notifications.schoolId, school.id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
