import { db } from '@/lib/db'
import { students, attendanceSessions, attendanceEntries } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/attendance/overview', () => {
  afterEach(async () => {
    await db.delete(attendanceEntries)
    await db.delete(attendanceSessions)
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance/overview'))
    expect(res.status).toBe(401)
  })

  it('computes metrics from Postgres sessions and entries and returns distinct batches', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    // Insert active students in different programs and batches
    await db.insert(students).values([
      { name: 'Student A', class: '11 - A', batch: 'Grade 11-A', program: 'JEE Integrated', isActive: true },
      { name: 'Student B', class: '10 - A', batch: 'Grade 10-A', program: 'Foundational', isActive: true },
    ])

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // Insert an attendance session & entry
    const [session] = await db.insert(attendanceSessions).values({
      date: dateStr,
      batch: 'Grade 11-A',
      subject: 'Physics',
    }).returning()

    await db.insert(attendanceEntries).values({
      sessionId: session.id,
      studentName: 'Student A',
      status: 'Present',
    })

    const res = await GET(req('http://localhost/api/attendance/overview?range=7'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overallRate).toBe(100)
    expect(body.distinctBatches).toEqual(['Grade 10-A', 'Grade 11-A'])
  })
})
