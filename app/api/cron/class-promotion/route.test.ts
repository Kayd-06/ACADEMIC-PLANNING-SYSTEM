import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, classPromotionRuns, notifications } from '@/lib/db/schema'
import { NextRequest } from 'next/server'
import { GET } from './route'

jest.setTimeout(30000)

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/class-promotion', { headers })
}

describe('GET /api/cron/class-promotion', () => {
  const createdSchoolIds: string[] = []
  let reactivatedSchoolIds: string[] = []

  beforeEach(async () => {
    process.env.CRON_SECRET = 'test-secret'
    // This endpoint scans every school with isActive = true. On the shared
    // dev database that would create real class_promotion_runs rows and
    // fire real notifications for schools that have nothing to do with
    // this test. Deactivate every other active school for the test's
    // duration and restore them in afterEach. Bulk-updated (not row-by-row)
    // since the shared dev DB has ~200 active schools.
    const others = await db.select({ id: schools.id }).from(schools).where(eq(schools.isActive, true))
    reactivatedSchoolIds = others.map((o) => o.id)
    if (reactivatedSchoolIds.length > 0) {
      await db.update(schools).set({ isActive: false }).where(inArray(schools.id, reactivatedSchoolIds))
    }
  })

  afterEach(async () => {
    if (reactivatedSchoolIds.length > 0) {
      await db.update(schools).set({ isActive: true }).where(inArray(schools.id, reactivatedSchoolIds))
    }
    reactivatedSchoolIds = []
    for (const id of createdSchoolIds) {
      await db.delete(notifications).where(eq(notifications.schoolId, id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.schoolId, id))
      await db.delete(users).where(eq(users.schoolId, id))
      await db.delete(schools).where(eq(schools.id, id))
    }
    createdSchoolIds.length = 0
    delete process.env.CRON_SECRET
  })

  it('rejects a request without the correct bearer token', async () => {
    const res = await GET(req({ authorization: 'Bearer wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('creates exactly one pending run and notification on first call, and none on a same-day retry', async () => {
    const [school] = await db.insert(schools).values({ isActive: true, academicYearStartMonth: 4 }).returning()
    createdSchoolIds.push(school.id)
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()

    const first = await GET(req({ authorization: 'Bearer test-secret' }))
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.runsCreated).toBe(1)

    const runs = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('pending')

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, manager.id))
    expect(notifs).toHaveLength(1)

    const second = await GET(req({ authorization: 'Bearer test-secret' }))
    const secondBody = await second.json()
    expect(secondBody.runsCreated).toBe(0)

    const runsAfterRetry = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
    expect(runsAfterRetry).toHaveLength(1)
  })
})
