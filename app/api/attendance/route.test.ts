import { db } from '@/lib/db'
import { students, attendanceSessions, attendanceEntries } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

const createdStudentIds: string[] = []
const createdSessionIds: string[] = []

describe('GET /api/attendance', () => {
  afterEach(async () => {
    if (createdSessionIds.length > 0) {
      await db.delete(attendanceEntries).where(inArray(attendanceEntries.sessionId, createdSessionIds))
      await db.delete(attendanceSessions).where(inArray(attendanceSessions.id, createdSessionIds))
      createdSessionIds.length = 0
    }
    if (createdStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, createdStudentIds))
      createdStudentIds.length = 0
    }
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    expect(res.status).toBe(401)
  })

  it('rejects when required query params are missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/attendance'))
    expect(res.status).toBe(400)
  })

  it('returns the existing sheet when one is already marked', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: null } })
    const [insertedSession] = await db.insert(attendanceSessions).values({
      date: '2026-01-01',
      batch: '11 - A',
      subject: 'Physics',
      classTime: '09:00 AM - 10:00 AM',
      markedByName: 'Teacher',
      markedByEmail: 't@example.com'
    }).returning()
    createdSessionIds.push(insertedSession.id)

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics&classTime=09:00 AM - 10:00 AM'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body._id).toBe(insertedSession.id)
    expect(body.date).toBe('2026-01-01')
  })

  it('builds a default record template from real Postgres students when no sheet exists', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: null } })
    const inserted = await db.insert(students).values(
      Array.from({ length: 3 }, (_, i) => ({ name: `Student ${i}`, batch: '11 - A', class: '11 - A', rollNo: String(i), isActive: true }))
    ).returning()
    createdStudentIds.push(...inserted.map(s => s.id))

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-02&batch=11 - A&subject=Physics'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isNew).toBe(true)
    expect(body.records.length).toBeGreaterThanOrEqual(3)
  })
})

describe('POST /api/attendance', () => {
  afterEach(async () => {
    if (createdSessionIds.length > 0) {
      await db.delete(attendanceEntries).where(inArray(attendanceEntries.sessionId, createdSessionIds))
      await db.delete(attendanceSessions).where(inArray(attendanceSessions.id, createdSessionIds))
      createdSessionIds.length = 0
    }
    if (createdStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, createdStudentIds))
      createdStudentIds.length = 0
    }
    jest.clearAllMocks()
  })

  it('rejects when the role is not teacher or management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('upserts the attendance sheet with the given records', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', name: 'Mr. Physics', email: 'p@example.com', schoolId: null } })
    const [student] = await db.insert(students).values({ name: 'Attendance Payer', rollNo: '001', class: '11 - A', section: 'A', isActive: true }).returning()
    createdStudentIds.push(student.id)

    const res = await POST(
      req('http://localhost/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-01-05',
          batch: '11 - A',
          subject: 'Physics',
          records: [{ studentId: student.id, studentName: student.name, rollNo: student.rollNo, status: 'Present' }],
        }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body._id).toBeDefined()
    expect(body.date).toBe('2026-01-05')
    if (body._id) createdSessionIds.push(body._id)
  })
})
