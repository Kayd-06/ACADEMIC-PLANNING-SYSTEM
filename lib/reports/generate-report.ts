import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, type GeneratedStudentReport } from '@/lib/db/schema'
import { computeStudentAnalytics } from '@/lib/reports/student-analytics'
import {
  createGeneratedReport,
  updateGeneratedReport,
  getReportByStudentTerm,
  replaceReportSubjectAnalytics,
  type SubjectAnalyticsPayload,
} from '@/lib/db/queries/generated-reports'

export interface GenerateStudentReportParams {
  studentId: string
  schoolId: string
  batchId: string | null
  academicYear: string
  term: string
  fromDate: string
  toDate: string
  generatedBy: string | null
}

export interface GenerateStudentReportResult {
  report: GeneratedStudentReport
  outcome: 'generated' | 'skipped'
  reason?: string
}

const LOCKED_STATUSES = ['PUBLISHED', 'SENT_TO_PARENT']

export async function generateStudentReport(
  params: GenerateStudentReportParams,
): Promise<GenerateStudentReportResult> {
  const { studentId, schoolId, batchId, academicYear, term, fromDate, toDate, generatedBy } = params

  const analytics = await computeStudentAnalytics(studentId, schoolId, { fromDate, toDate })
  if (!analytics) {
    throw new Error(`Student ${studentId} not found for school ${schoolId}`)
  }

  const subjectPayloads: SubjectAnalyticsPayload[] = analytics.performanceReport.subjectBreakdown.map((s) => {
    const coverage = analytics.subjectCoverage.find((c) => c.subject === s.subject)
    let grade = 'F'
    if (s.percentage >= 90) grade = 'A+'
    else if (s.percentage >= 80) grade = 'A'
    else if (s.percentage >= 70) grade = 'B'
    else if (s.percentage >= 60) grade = 'C'
    else if (s.percentage >= 50) grade = 'D'

    return {
      subjectName: s.subject,
      marksObtained: s.marksObtained,
      maxMarks: s.maxMarks,
      grade,
      totalChaptersTaught: coverage?.totalChaptersTaught ?? 0,
      completedChaptersCount: coverage?.completedChaptersCount ?? 0,
      conceptsMasteredCount: coverage?.conceptsMasteredCount ?? 0,
      conceptsTotalCount: coverage?.conceptsTotalCount ?? 0,
    }
  })

  const computedFields = {
    overallPercentage: `${analytics.performanceReport.overallPercentage}%`,
    overallGrade: analytics.performanceReport.overallGrade,
    classRank: String(analytics.performanceReport.rank),
    batchRank: `${analytics.performanceReport.rank}/${analytics.performanceReport.totalStudentsInBatch}`,
    attendancePercentage: analytics.attendance.percentage,
    syllabusCoveragePercentage: computeAverageCoverage(analytics.subjectCoverage),
  }

  const existing = await getReportByStudentTerm(studentId, academicYear, term, schoolId)

  if (existing && LOCKED_STATUSES.includes(existing.status)) {
    return { report: existing, outcome: 'skipped', reason: `already ${existing.status}` }
  }

  if (existing) {
    const updated = await updateGeneratedReport(existing.id, computedFields, schoolId)
    await replaceReportSubjectAnalytics(existing.id, subjectPayloads)
    return { report: updated!, outcome: 'generated' }
  }

  const created = await createGeneratedReport({
    schoolId,
    studentId,
    batchId,
    reportTitle: `${term} Report - ${academicYear}`,
    academicYear,
    term,
    generatedBy,
    subjects: subjectPayloads,
    ...computedFields,
  })
  return { report: created, outcome: 'generated' }
}

function computeAverageCoverage(subjectCoverage: { totalChaptersTaught: number; completedChaptersCount: number }[]): number {
  const totals = subjectCoverage.reduce(
    (acc, s) => ({ taught: acc.taught + s.totalChaptersTaught, completed: acc.completed + s.completedChaptersCount }),
    { taught: 0, completed: 0 },
  )
  return totals.taught > 0 ? Math.round((totals.completed / totals.taught) * 100) : 0
}

export interface GenerateBatchReportsParams {
  batchId: string
  schoolId: string
  academicYear: string
  term: string
  fromDate: string
  toDate: string
  generatedBy: string | null
}

export interface GenerateBatchReportsResult {
  results: Array<{
    studentId: string
    outcome: 'generated' | 'skipped' | 'failed'
    reason?: string
  }>
}

export async function generateBatchReports(
  params: GenerateBatchReportsParams,
): Promise<GenerateBatchReportsResult> {
  const { batchId, schoolId, academicYear, term, fromDate, toDate, generatedBy } = params

  const activeStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.batchId, batchId), eq(students.schoolId, schoolId), eq(students.isActive, true)))

  const results: GenerateBatchReportsResult['results'] = []

  for (const student of activeStudents) {
    try {
      const { outcome, reason } = await generateStudentReport({
        studentId: student.id, schoolId, batchId, academicYear, term, fromDate, toDate, generatedBy,
      })
      results.push({ studentId: student.id, outcome, reason })
    } catch (err: any) {
      results.push({ studentId: student.id, outcome: 'failed', reason: err.message ?? 'Unknown error' })
    }
  }

  return { results }
}
