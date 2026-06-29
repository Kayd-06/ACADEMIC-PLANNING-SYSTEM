import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('POST /api/teacher-portal/reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(401)
  })

  it('rejects non-teacher roles', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'x', role: 'management' } })
    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({ className: 'A', subject: 'B', term: 'C', students: [{ name: 'X', marks: 1, grade: 'A' }] }) }))
    expect(res.status).toBe(403)
  })

  it('saves a report with the session teacherId, without requiring attendance', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    const res = await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A',
          subject: 'Physics',
          term: 'Mid-Term',
          students: [{ name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' }],
        }),
      })
    )
    expect(res.status).toBe(201)

    const reports = await db.select().from(studentReports)
    expect(reports).toHaveLength(1)
    expect(reports[0].teacherId).toBe(teacher.id)

    const entries = await db.select().from(studentReportEntries)
    expect(entries).toHaveLength(1)
    expect(entries[0].attendance).toBeNull()
  })

  it('saves attendance and remarks when the payload includes them', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A',
          subject: 'Physics',
          term: 'Mid-Term',
          students: [{ name: 'Priya Patel', rollNo: '102', marks: 90, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Excellent' }],
        }),
      })
    )

    const entries = await db.select().from(studentReportEntries)
    expect(entries[0].attendance).toBe(98)
    expect(entries[0].remarks).toBe('Excellent')
  })

  it('rejects when required fields are missing', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({ className: 'A' }) }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/teacher-portal/reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('returns only the current teacher own reports, with computed average score', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, name: teacherA.name, role: 'teacher' } })

    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
          students: [
            { name: 'A', rollNo: '1', marks: 80, maxMarks: 100, grade: 'A' },
            { name: 'B', rollNo: '2', marks: 60, maxMarks: 100, grade: 'B' },
          ],
        }),
      })
    )
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherB.id, name: teacherB.name, role: 'teacher' } })
    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({ className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals', students: [{ name: 'C', rollNo: '3', marks: 40, maxMarks: 100, grade: 'D' }] }),
      })
    )

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, name: teacherA.name, role: 'teacher' } })
    const res = await GET()
    const body = await res.json()

    expect(body).toHaveLength(1)
    expect(body[0].class).toBe('Grade 10-A')
    expect(body[0].students).toBe(2)
    expect(body[0].avg).toBe('70%')
  })
})
