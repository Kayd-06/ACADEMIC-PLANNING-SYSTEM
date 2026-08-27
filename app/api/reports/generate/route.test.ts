import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, batches, generatedStudentReports } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/reports/generate', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    batches: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
    jest.clearAllMocks()
  })

  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(req({ studentId: 'x', academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30' }))
    expect(res.status).toBe(401)
  })

  it('rejects when neither studentId nor batchId is provided', async () => {
    const [school] = await db.insert(schools).values({ name: 'Validation School' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({ academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30' }))
    expect(res.status).toBe(400)
  })

  it('rejects when both studentId and batchId are provided', async () => {
    const [school] = await db.insert(schools).values({ name: 'Validation School 2' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({
      studentId: 'x', batchId: 'y', academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(400)
  })

  it('generates a single student report and returns the outcome', async () => {
    const [school] = await db.insert(schools).values({ name: 'Single Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Single Gen Student', schoolId: school.id, batch: 'S1' }).returning()
    createdIds.students.push(student.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({
      studentId: student.id, academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outcome).toBe('generated')
    expect(body.report.studentId).toBe(student.id)
    createdIds.reports.push(body.report.id)
  })

  it('generates batch reports and returns a per-student summary', async () => {
    const [school] = await db.insert(schools).values({ name: 'Batch Gen Route School' }).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({ name: `ROUTEBATCH-${Date.now()}`, schoolId: school.id }).returning()
    createdIds.batches.push(batch.id)
    const [student] = await db.insert(students).values({
      name: 'Batch Route Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: true,
    }).returning()
    createdIds.students.push(student.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({
      batchId: batch.id, academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].outcome).toBe('generated')

    const rows = await db.select().from(generatedStudentReports).where(eq(generatedStudentReports.batchId, batch.id))
    createdIds.reports.push(...rows.map((r: any) => r.id))
  })
})
