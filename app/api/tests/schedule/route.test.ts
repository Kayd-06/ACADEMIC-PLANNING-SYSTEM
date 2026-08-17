import { db } from '@/lib/db'
import { tests, users, batches, schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST, PUT, DELETE } from './route'

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

async function createSchool(name = 'Test School') {
  const [s] = await db.insert(schools).values({ name }).returning()
  return s
}

describe('tests/schedule ownership', () => {
  // Scoped-by-ID cleanup only — never db.delete(tests)/db.delete(users) with no WHERE
  // (both are DB-Guard-protected tables; an unscoped delete silently no-ops and leaks fixtures).
  const createdTestIds: string[] = []
  const createdUserIds: string[] = []
  const createdSchoolIds: string[] = []

  async function createUserAndTrack(name: string, role: 'teacher' | 'management') {
    const u = await createUser(name, role)
    createdUserIds.push(u.id)
    return u
  }

  afterEach(async () => {
    for (const id of createdTestIds) {
      if (id) await db.delete(tests).where(eq(tests.id, id))
    }
    createdTestIds.length = 0
    for (const id of createdUserIds) {
      if (id) await db.delete(users).where(eq(users.id, id))
    }
    createdUserIds.length = 0
    for (const id of createdSchoolIds) {
      if (id) await db.delete(schools).where(eq(schools.id, id))
    }
    createdSchoolIds.length = 0
    // batches is not DB-Guard-protected, so an unscoped delete here is safe.
    await db.delete(batches)
    jest.clearAllMocks()
  })

  it('POST stamps createdByUserId with the creating teacher', async () => {
    const teacher = await createUserAndTrack('Teacher A', 'teacher')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher' } })

    const res = await POST(req('http://localhost/api/tests/schedule', {
      method: 'POST',
      body: JSON.stringify({
        title: 'A Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100,
      }),
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    createdTestIds.push(body.id)
    expect(body.createdByUserId).toBe(teacher.id)
  })

  it('GET for a teacher only returns their own tests, never another teacher\'s', async () => {
    const teacherA = await createUserAndTrack('Teacher A2', 'teacher')
    const teacherB = await createUserAndTrack('Teacher B2', 'teacher')

    const inserted = await db.insert(tests).values([
      { title: 'A Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherA.id },
      { title: 'B Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id },
    ]).returning()
    createdTestIds.push(...inserted.map(t => t.id))

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher' } })

    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body.map((t: any) => t.title)).toEqual(['A Owned'])
  })

  it('GET for management returns every test in the school, including legacy owner-less rows', async () => {
    const teacher = await createUserAndTrack('Teacher C', 'teacher')
    const manager = await createUserAndTrack('Manager A', 'management')
    const testSchool = await createSchool('Sched Test School 1')
    createdSchoolIds.push(testSchool.id)

    const inserted = await db.insert(tests).values([
      { title: 'Owned Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id, schoolId: testSchool.id },
      { title: 'Legacy Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: null, schoolId: testSchool.id },
    ]).returning()
    createdTestIds.push(...inserted.map(t => t.id))

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: testSchool.id } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body.map((t: any) => t.title).sort()).toEqual(['Legacy Test', 'Owned Test'])
  })

  it('PUT returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUserAndTrack('Teacher D', 'teacher')
    const teacherB = await createUserAndTrack('Teacher E', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()
    createdTestIds.push(otherTest.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await PUT(req('http://localhost/api/tests/schedule', {
      method: 'PUT',
      body: JSON.stringify({ id: otherTest.id, title: 'Hacked', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUserAndTrack('Teacher F', 'teacher')
    const teacherB = await createUserAndTrack('Teacher G', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine Either', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()
    createdTestIds.push(otherTest.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/schedule?id=${otherTest.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(404)

    const stillThere = await db.select().from(tests).where(eq(tests.id, otherTest.id))
    expect(stillThere).toHaveLength(1)
  })

  it('GET includes facultyName and supports the program query filter', async () => {
    const teacher = await createUserAndTrack('Teacher H', 'teacher')
    const manager = await createUserAndTrack('Manager B', 'management')
    const testSchool = await createSchool('Sched Test School 2')
    createdSchoolIds.push(testSchool.id)

    const inserted = await db.insert(tests).values([
      { title: 'JEE Test', batch: 'Batch A', program: 'JEE 2026', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id, schoolId: testSchool.id },
      { title: 'NEET Test', batch: 'Batch A', program: 'NEET 2026', subject: 'Biology', date: '2026-08-01', createdByUserId: teacher.id, schoolId: testSchool.id },
    ]).returning()
    createdTestIds.push(...inserted.map(t => t.id))

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: testSchool.id } })

    const allRes = await GET(req('http://localhost/api/tests/schedule'))
    const allBody = await allRes.json()
    const jeeRow = allBody.find((t: any) => t.title === 'JEE Test')
    expect(jeeRow.facultyName).toBe('Teacher H')

    const filteredRes = await GET(req('http://localhost/api/tests/schedule?program=NEET%202026'))
    const filteredBody = await filteredRes.json()
    expect(filteredBody.map((t: any) => t.title)).toEqual(['NEET Test'])
  })

  it('GET supports the teacherId query filter for management', async () => {
    const teacherA = await createUserAndTrack('Teacher I', 'teacher')
    const teacherB = await createUserAndTrack('Teacher J', 'teacher')
    const manager = await createUserAndTrack('Manager C', 'management')
    const inserted = await db.insert(tests).values([
      { title: 'A Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherA.id },
      { title: 'B Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id },
    ]).returning()
    createdTestIds.push(...inserted.map(t => t.id))

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/schedule?teacherId=${teacherA.id}`))
    const body = await res.json()
    expect(body.map((t: any) => t.title)).toEqual(['A Owned'])
  })

  it('POST persists batchId when provided', async () => {
    const teacher = await createUserAndTrack('Teacher K', 'teacher')
    const [batch] = await db.insert(batches).values({ name: 'Schedule Batch' }).returning()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })

    const res = await POST(req('http://localhost/api/tests/schedule', {
      method: 'POST',
      body: JSON.stringify({ title: 'Quiz', batch: 'Batch A', batchId: batch.id, subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.batchId).toBe(batch.id)
    createdTestIds.push(body.id)
  })

  it('PUT updates batchId', async () => {
    const teacher = await createUserAndTrack('Teacher L', 'teacher')
    const [batch] = await db.insert(batches).values({ name: 'Schedule Batch 2' }).returning()
    const [existing] = await db.insert(tests).values({
      title: 'Original', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id,
    }).returning()
    createdTestIds.push(existing.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })
    const res = await PUT(req('http://localhost/api/tests/schedule', {
      method: 'PUT',
      body: JSON.stringify({ id: existing.id, title: 'Original', batch: 'Batch A', batchId: batch.id, subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.batchId).toBe(batch.id)
  })

  it('GET includes batchId in the row shape', async () => {
    const teacher = await createUserAndTrack('Teacher M', 'teacher')
    const [batch] = await db.insert(batches).values({ name: 'Schedule Batch 3' }).returning()
    const [test] = await db.insert(tests).values({ title: 'Shaped Test', batch: 'Batch A', batchId: batch.id, subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id }).returning()
    createdTestIds.push(test.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body[0].batchId).toBe(batch.id)
  })
})
