import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/student-reports') as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('GET /api/student-reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('management sees every report across all teachers', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'management' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it('a teacher sees only their own reports', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].className).toBe('Grade 10-A')
  })

  it('never seeds data — an empty database returns an empty array, every time', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: '00000000-0000-0000-0000-000000000000', role: 'teacher' } })
    const first = await (await GET(req())).json()
    const second = await (await GET(req())).json()
    expect(first).toEqual([])
    expect(second).toEqual([])
  })

  it('does not grow report count across repeated GET calls for a teacher with existing reports', async () => {
    const teacherA = await makeTeacher('Teacher A')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher' } })
    await GET(req())
    await GET(req())
    await GET(req())

    const all = await db.select().from(studentReports)
    expect(all).toHaveLength(1)
  })
})
