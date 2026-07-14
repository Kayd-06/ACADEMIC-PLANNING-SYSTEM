import { db } from '@/lib/db'
import { tests, testGrades, students, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))
jest.mock('@/lib/scheduleUtils', () => ({ getLocalToday: () => '2026-08-15' }))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/[id]/grades', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('GET returns the real batch roster with null grades when nothing has been saved yet', async () => {
    const owner = await createUser('Grade Owner', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Roster Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    await db.insert(students).values({ name: 'Student One', rollNo: '001', batch: 'Batch Grade', isActive: true })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.studentResults).toHaveLength(1)
    expect(body.studentResults[0].marksObtained).toBeNull()
  })

  it('GET rejects a teacher who does not own the test', async () => {
    const owner = await createUser('Grade Owner Two', 'teacher')
    const outsider = await createUser('Grade Outsider', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Not Yours', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: outsider.id, role: 'teacher', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
  })

  it('POST rejects grading a test scheduled in the future', async () => {
    const owner = await createUser('Grade Owner Three', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Future Test', batch: 'Batch Grade', subject: 'Physics', date: '2099-01-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [student] = await db.insert(students).values({ name: 'Future Student', rollNo: '001', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST',
      body: JSON.stringify({ grades: [{ studentId: student.id, marksObtained: 80 }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(409)
  })

  it('POST saves grades, computes averageScore, and marks the test Graded', async () => {
    const owner = await createUser('Grade Owner Four', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Gradable Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [s1] = await db.insert(students).values({ name: 'S One', rollNo: '001', batch: 'Batch Grade', isActive: true }).returning()
    const [s2] = await db.insert(students).values({ name: 'S Two', rollNo: '002', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST',
      body: JSON.stringify({ grades: [
        { studentId: s1.id, marksObtained: 80 },
        { studentId: s2.id, marksObtained: 60 },
      ] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.test.status).toBe('Graded')
    expect(body.test.averageScore).toBe(70)

    const getRes = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    const getBody = await getRes.json()
    const byRoll = Object.fromEntries(getBody.studentResults.map((r: any) => [r.rollNo, r]))
    expect(byRoll['001'].rank).toBe(1)
    expect(byRoll['001'].percentage).toBe(80)
    expect(byRoll['002'].rank).toBe(2)
  })

  it('POST is idempotent — grading the same test twice updates rather than duplicates rows', async () => {
    const owner = await createUser('Grade Owner Five', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Regrade Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [s1] = await db.insert(students).values({ name: 'S Three', rollNo: '003', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST', body: JSON.stringify({ grades: [{ studentId: s1.id, marksObtained: 50 }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST', body: JSON.stringify({ grades: [{ studentId: s1.id, marksObtained: 90 }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const rows = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].marksObtained).toBe(90)
  })
})
