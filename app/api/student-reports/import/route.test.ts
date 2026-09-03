jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: { user?: { schoolId?: string } } | null) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/db/queries/student-reports', () => ({ createReport: jest.fn() }))

import { auth } from '@/lib/auth'
import { createReport } from '@/lib/db/queries/student-reports'
import type { NextRequest } from 'next/server'
import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/student-reports/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe('POST /api/student-reports/import', () => {
  beforeEach(() => jest.clearAllMocks())

  it('requires an authenticated staff session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const response = await POST(request({}))
    expect(response.status).toBe(401)
    expect(createReport).not.toHaveBeenCalled()
  })

  it('validates rows before accessing the database', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'manager-1', name: 'Admin', role: 'management', schoolId: 'school-1' } })
    const response = await POST(request({
      className: 'Grade 10-A', subject: 'Physics', term: 'Finals',
      entries: [{ name: 'Student', rollNo: '1', marks: 110, maxMarks: 100 }],
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.errors[0]).toEqual(expect.objectContaining({ row: 2, field: 'Marks' }))
    expect(createReport).not.toHaveBeenCalled()
  })

  it('allows management imports and records their source metadata', async () => {
    ;(auth as jest.Mock).mockResolvedValue({
      user: { id: 'manager-1', name: 'Academic Admin', role: 'management', schoolId: 'school-1' },
    })
    ;(createReport as jest.Mock).mockImplementation(async (input) => ({
      id: 'report-1', entries: input.entries,
    }))

    const response = await POST(request({
      className: 'Grade 10-A', subject: 'Physics', term: 'Finals', sourceFileName: 'marks.xlsx',
      entries: [{ name: 'Student', rollNo: '1', marks: 81, maxMarks: 100, attendance: 94 }],
    }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.imported).toBe(1)
    expect(createReport).toHaveBeenCalledWith(expect.objectContaining({
      teacherId: 'manager-1',
      teacherName: 'Academic Admin',
      schoolId: 'school-1',
      importedByRole: 'management',
      sourceFileName: 'marks.xlsx',
      entries: [expect.objectContaining({ grade: 'A' })],
    }))
  })
})
