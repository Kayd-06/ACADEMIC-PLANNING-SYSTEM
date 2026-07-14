import { db } from '@/lib/db'
import { students, tests, testGrades } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/queries/student-reports', () => ({
  getReportById: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { getReportById } from '@/lib/db/queries/student-reports'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/student-reports/[id] test performance', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('includes a computed testAverage per entry from real test_grades data', async () => {
    const [student] = await db.insert(students).values({ name: 'Report Student', rollNo: 'R1', class: '11 - A' }).returning()
    const [test] = await db.insert(tests).values({ title: 'Unit 1', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    await db.insert(testGrades).values({ testId: test.id, studentId: student.id, marksObtained: 90, absent: false })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'teacher-1', role: 'management', schoolId: null } })
    ;(getReportById as jest.Mock).mockResolvedValue({
      id: 'report-1', teacherId: 'teacher-1', teacherName: 'T', className: '11 - A', subject: 'Physics', term: 'Term 1',
      schoolId: null, createdAt: new Date(),
      entries: [{ name: 'Report Student', rollNo: 'R1', marks: 40, maxMarks: 50, grade: 'A', attendance: null, remarks: null }],
    })

    const res = await GET(req('http://localhost/api/student-reports/report-1'), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(body.entries[0].testAverage).toBe(90)
    expect(body.entries[0].testCount).toBe(1)
  })
})
