import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, students, studentBatchEnrollments, classPromotionRuns, classPromotionLog } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req() {
  return new Request('http://localhost/api/academic-planning/promotions/x/confirm', { method: 'POST' }) as any
}

describe('POST /api/academic-planning/promotions/[runId]/confirm', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await POST(req(), { params: Promise.resolve({ runId: 'any' }) })
    expect(res.status).toBe(403)
  })

  it('promotes eligible students, clears batch, completes enrollment, logs the change, and leaves Class 12/Repeater untouched', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({
      name: 'Promotable', class: '9', batch: 'Morning', admissionDate: '2025-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [enrollment] = await db.insert(studentBatchEnrollments).values({
      studentId: student.id, batchName: 'Morning', status: 'active',
    }).returning()
    const [class12Student] = await db.insert(students).values({
      name: 'Twelfth', class: '12', batch: 'Evening', admissionDate: '2020-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [repeaterStudent] = await db.insert(students).values({
      name: 'Repeats', class: 'Repeater', batch: 'Evening', admissionDate: '2020-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.promotedCount).toBe(1)

      const [updatedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(updatedStudent.class).toBe('10')
      expect(updatedStudent.batch).toBe('')

      const [updatedEnrollment] = await db.select().from(studentBatchEnrollments).where(eq(studentBatchEnrollments.id, enrollment.id))
      expect(updatedEnrollment.status).toBe('completed')

      const logs = await db.select().from(classPromotionLog).where(eq(classPromotionLog.runId, run.id))
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({ studentId: student.id, fromClass: '9', toClass: '10', previousBatch: 'Morning' })

      const [updatedRun] = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      expect(updatedRun.status).toBe('confirmed')
      expect(updatedRun.confirmedBy).toBe(manager.id)

      const [unchangedClass12] = await db.select().from(students).where(eq(students.id, class12Student.id))
      expect(unchangedClass12.class).toBe('12')
      expect(unchangedClass12.batch).toBe('Evening')

      const [unchangedRepeater] = await db.select().from(students).where(eq(students.id, repeaterStudent.id))
      expect(unchangedRepeater.class).toBe('Repeater')
      expect(unchangedRepeater.batch).toBe('Evening')
    } finally {
      await db.delete(classPromotionLog).where(eq(classPromotionLog.runId, run.id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(studentBatchEnrollments).where(eq(studentBatchEnrollments.studentId, student.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('skips a student who was deactivated between detection and confirm (re-validates eligibility)', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({
      name: 'Deactivated', class: '9', batch: 'Morning', admissionDate: '2025-01-01', schoolId: school.id, isActive: false,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      const body = await res.json()
      expect(body.promotedCount).toBe(0)

      const [unchangedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(unchangedStudent.class).toBe('9')
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('rejects confirming a run that is already confirmed', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'confirmed', previewCounts: {},
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(400)
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
