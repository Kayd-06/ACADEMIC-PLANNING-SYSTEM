import { db } from '@/lib/db'
import { tests, users } from '@/lib/db/schema'
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

describe('tests/schedule ownership', () => {
  afterEach(async () => {
    await db.delete(tests)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('POST stamps createdByUserId with the creating teacher', async () => {
    const teacher = await createUser('Teacher One', 'teacher')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })

    const res = await POST(req('http://localhost/api/tests/schedule', {
      method: 'POST',
      body: JSON.stringify({ title: 'Quiz', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.createdByUserId).toBe(teacher.id)
  })

  it('GET for a teacher only returns their own tests, never another teacher\'s', async () => {
    const teacherA = await createUser('Teacher A', 'teacher')
    const teacherB = await createUser('Teacher B', 'teacher')
    await db.insert(tests).values([
      { title: 'A Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherA.id },
      { title: 'B Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('A Test')
  })

  it('GET for management returns every test in the school, including legacy owner-less rows', async () => {
    const teacher = await createUser('Teacher C', 'teacher')
    const manager = await createUser('Manager A', 'management')
    await db.insert(tests).values([
      { title: 'Owned Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id },
      { title: 'Legacy Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: null },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body.map((t: any) => t.title).sort()).toEqual(['Legacy Test', 'Owned Test'])
  })

  it('PUT returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUser('Teacher D', 'teacher')
    const teacherB = await createUser('Teacher E', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await PUT(req('http://localhost/api/tests/schedule', {
      method: 'PUT',
      body: JSON.stringify({ id: otherTest.id, title: 'Hacked', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUser('Teacher F', 'teacher')
    const teacherB = await createUser('Teacher G', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine Either', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/schedule?id=${otherTest.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(404)

    const stillThere = await db.select().from(tests).where(eq(tests.id, otherTest.id))
    expect(stillThere).toHaveLength(1)
  })

  it('GET includes facultyName and supports the program query filter', async () => {
    const teacher = await createUser('Teacher H', 'teacher')
    const manager = await createUser('Manager B', 'management')
    await db.insert(tests).values([
      { title: 'JEE Test', batch: 'Batch A', program: 'JEE 2026', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id },
      { title: 'NEET Test', batch: 'Batch A', program: 'NEET 2026', subject: 'Biology', date: '2026-08-01', createdByUserId: teacher.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })

    const allRes = await GET(req('http://localhost/api/tests/schedule'))
    const allBody = await allRes.json()
    const jeeRow = allBody.find((t: any) => t.title === 'JEE Test')
    expect(jeeRow.facultyName).toBe('Teacher H')

    const filteredRes = await GET(req('http://localhost/api/tests/schedule?program=NEET%202026'))
    const filteredBody = await filteredRes.json()
    expect(filteredBody.map((t: any) => t.title)).toEqual(['NEET Test'])
  })

  it('GET supports the teacherId query filter for management', async () => {
    const teacherA = await createUser('Teacher I', 'teacher')
    const teacherB = await createUser('Teacher J', 'teacher')
    const manager = await createUser('Manager C', 'management')
    await db.insert(tests).values([
      { title: 'A Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherA.id },
      { title: 'B Owned', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/schedule?teacherId=${teacherA.id}`))
    const body = await res.json()
    expect(body.map((t: any) => t.title)).toEqual(['A Owned'])
  })
})
