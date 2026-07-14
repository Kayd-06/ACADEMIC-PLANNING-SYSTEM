import { eq, and, desc } from 'drizzle-orm'
import { db } from '../index'
import { testGrades, tests } from '../schema'

export interface TestPerformanceEntry {
  testId: string
  title: string
  subject: string
  date: string
  marksObtained: number | null
  totalMarks: number
  percentage: number | null
  absent: boolean
}

// Live per-student test performance, joined from test_grades/tests — never
// duplicated into student_report_entries, so grading changes are always
// reflected immediately in Student Reports.
export async function computeTestPerformance(
  studentId: string,
  schoolId: string | null
): Promise<TestPerformanceEntry[]> {
  if (!studentId) return []

  const conditions = [eq(testGrades.studentId, studentId)]
  if (schoolId) conditions.push(eq(testGrades.schoolId, schoolId))

  const rows = await db
    .select({
      testId: tests.id,
      title: tests.title,
      subject: tests.subject,
      date: tests.date,
      totalMarks: tests.totalMarks,
      marksObtained: testGrades.marksObtained,
      absent: testGrades.absent,
    })
    .from(testGrades)
    .innerJoin(tests, eq(testGrades.testId, tests.id))
    .where(and(...conditions))
    .orderBy(desc(tests.date))

  return rows.map(r => ({
    testId: r.testId,
    title: r.title,
    subject: r.subject,
    date: r.date,
    marksObtained: r.marksObtained,
    totalMarks: r.totalMarks,
    percentage: !r.absent && r.marksObtained !== null
      ? Math.round((r.marksObtained / r.totalMarks) * 1000) / 10
      : null,
    absent: r.absent,
  }))
}
