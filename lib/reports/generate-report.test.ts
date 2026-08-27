import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  schools,
  students,
  batches,
  tests,
  questions,
  testQuestionResponses,
  generatedStudentReports,
  reportSubjectAnalytics,
} from '@/lib/db/schema'
import { generateStudentReport, generateBatchReports } from './generate-report'
import { updateGeneratedReport } from '@/lib/db/queries/generated-reports'

describe('generateStudentReport / generateBatchReports', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    batches: [] as string[],
    tests: [] as string[],
    questions: [] as string[],
    responses: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.responses) await db.delete(testQuestionResponses).where(eq(testQuestionResponses.id, id))
    for (const id of createdIds.questions) await db.delete(questions).where(eq(questions.id, id))
    for (const id of createdIds.tests) await db.delete(tests).where(eq(tests.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
  })

  it('inserts a new DRAFT report on first generation for a student', async () => {
    const [school] = await db.insert(schools).values({ name: 'Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Gen Student', schoolId: school.id, batch: 'G1' }).returning()
    createdIds.students.push(student.id)

    const { report, outcome } = await generateStudentReport({
      studentId: student.id,
      schoolId: school.id,
      batchId: null,
      academicYear: '2026-27',
      term: 'Term 1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      generatedBy: null,
    })
    createdIds.reports.push(report.id)

    expect(outcome).toBe('generated')
    expect(report.status).toBe('DRAFT')
    expect(report.studentId).toBe(student.id)
  })

  it('overwrites computed fields in place on a second call while a report is DRAFT, without touching remarks', async () => {
    const [school] = await db.insert(schools).values({ name: 'Overwrite School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Overwrite Student', schoolId: school.id, batch: 'G2' }).returning()
    createdIds.students.push(student.id)

    const first = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })
    createdIds.reports.push(first.report.id)

    await updateGeneratedReport(first.report.id, { teacherRemarks: 'Hand-written remark' }, school.id)

    const second = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(second.outcome).toBe('generated')
    expect(second.report.id).toBe(first.report.id)
    expect(second.report.teacherRemarks).toBe('Hand-written remark')
  })

  it('skips generation for a PUBLISHED report', async () => {
    const [school] = await db.insert(schools).values({ name: 'Published School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Published Student', schoolId: school.id, batch: 'G3' }).returning()
    createdIds.students.push(student.id)

    const first = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })
    createdIds.reports.push(first.report.id)
    await updateGeneratedReport(first.report.id, { status: 'PUBLISHED' }, school.id)

    const second = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(second.outcome).toBe('skipped')
    expect(second.reason).toBe('already PUBLISHED')
  })

  it('generateBatchReports runs generateStudentReport for every active student in the batch', async () => {
    const [school] = await db.insert(schools).values({ name: 'Batch Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({ name: `BATCHGEN-${Date.now()}`, schoolId: school.id }).returning()
    createdIds.batches.push(batch.id)

    const [activeStudent] = await db.insert(students).values({
      name: 'Active Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: true,
    }).returning()
    const [inactiveStudent] = await db.insert(students).values({
      name: 'Inactive Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: false,
    }).returning()
    createdIds.students.push(activeStudent.id, inactiveStudent.id)

    const { results } = await generateBatchReports({
      batchId: batch.id, schoolId: school.id,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(results).toHaveLength(1)
    expect(results[0].studentId).toBe(activeStudent.id)
    expect(results[0].outcome).toBe('generated')

    const rows = await db.select().from(generatedStudentReports).where(eq(generatedStudentReports.batchId, batch.id))
    createdIds.reports.push(...rows.map((r) => r.id))
  })
})
