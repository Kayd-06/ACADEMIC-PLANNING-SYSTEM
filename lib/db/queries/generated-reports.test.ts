import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, generatedStudentReports, reportSubjectAnalytics } from '@/lib/db/schema'
import {
  getReportByStudentTerm,
  replaceReportSubjectAnalytics,
  createGeneratedReport,
} from './generated-reports'

describe('generated-reports queries: getReportByStudentTerm / replaceReportSubjectAnalytics', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
  })

  it('returns null when no report exists for the (studentId, academicYear, term) triple', async () => {
    const [school] = await db.insert(schools).values({ name: 'Lookup School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Lookup Student', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const found = await getReportByStudentTerm(student.id, '2026-27', 'Term 1', school.id)
    expect(found).toBeNull()
  })

  it('finds an existing report by (studentId, academicYear, term), scoped by schoolId', async () => {
    const [school] = await db.insert(schools).values({ name: 'Lookup School 2' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Lookup Student 2', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const created = await createGeneratedReport({
      schoolId: school.id, studentId: student.id, reportTitle: 'Term 1 Report',
      academicYear: '2026-27', term: 'Term 1',
    })
    createdIds.reports.push(created.id)

    const found = await getReportByStudentTerm(student.id, '2026-27', 'Term 1', school.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('replaces subject analytics rows, dropping subjects no longer present', async () => {
    const [school] = await db.insert(schools).values({ name: 'Replace School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Replace Student', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const created = await createGeneratedReport({
      schoolId: school.id, studentId: student.id, reportTitle: 'Replace Report',
      academicYear: '2026-27', term: 'Term 1',
      subjects: [
        { subjectName: 'Physics', marksObtained: 40, maxMarks: 100, grade: 'D' },
        { subjectName: 'Chemistry', marksObtained: 50, maxMarks: 100, grade: 'C' },
      ],
    })
    createdIds.reports.push(created.id)

    const replaced = await replaceReportSubjectAnalytics(created.id, [
      { subjectName: 'Physics', marksObtained: 90, maxMarks: 100, grade: 'A' },
    ])

    expect(replaced).toHaveLength(1)
    expect(replaced[0].subjectName).toBe('Physics')
    expect(replaced[0].marksObtained).toBe(90)

    const remaining = await db.select().from(reportSubjectAnalytics).where(eq(reportSubjectAnalytics.reportId, created.id))
    expect(remaining).toHaveLength(1)
    expect(remaining[0].subjectName).toBe('Physics')
  })
})
