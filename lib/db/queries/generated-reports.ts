import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  generatedStudentReports,
  reportSubjectAnalytics,
  type GeneratedStudentReport,
  type NewGeneratedStudentReport,
  type ReportSubjectAnalytics,
  type NewReportSubjectAnalytics,
} from '../schema'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedReportFilters {
  studentId?:   string | null
  batchId?:     string | null
  academicYear?: string | null
  term?:        string | null
  status?:      string | null
}

export interface GeneratedReportWithSubjects extends GeneratedStudentReport {
  subjects: ReportSubjectAnalytics[]
}

export interface CreateReportPayload {
  schoolId:                    string
  studentId:                   string
  batchId?:                    string | null
  reportTitle:                 string
  reportType?:                 string
  academicYear:                string
  term:                        string
  overallPercentage?:          string
  overallGrade?:               string
  classRank?:                  string
  batchRank?:                  string
  attendancePercentage?:       number
  syllabusCoveragePercentage?: number
  strengthAreas?:              string
  improvementAreas?:           string
  teacherRemarks?:             string
  principalRemarks?:           string
  generatedBy?:                string | null
  subjects?:                   SubjectAnalyticsPayload[]
}

export interface SubjectAnalyticsPayload {
  subjectName:             string
  marksObtained:           number
  maxMarks:                number
  grade:                   string
  totalChaptersTaught?:    number
  completedChaptersCount?: number
  conceptsMasteredCount?:  number
  conceptsTotalCount?:     number
  subjectTeacherRemarks?:  string
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listGeneratedReports(
  filters: GeneratedReportFilters = {},
  schoolId?: string | null,
): Promise<GeneratedStudentReport[]> {
  const conditions: any[] = []
  if (schoolId)             conditions.push(eq(generatedStudentReports.schoolId, schoolId))
  if (filters.studentId)   conditions.push(eq(generatedStudentReports.studentId, filters.studentId))
  if (filters.batchId)     conditions.push(eq(generatedStudentReports.batchId, filters.batchId))
  if (filters.academicYear) conditions.push(eq(generatedStudentReports.academicYear, filters.academicYear))
  if (filters.term)        conditions.push(eq(generatedStudentReports.term, filters.term))
  if (filters.status)      conditions.push(eq(generatedStudentReports.status, filters.status))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  return db
    .select()
    .from(generatedStudentReports)
    .where(where)
    .orderBy(desc(generatedStudentReports.createdAt))
}

export async function getGeneratedReportById(
  id: string,
  schoolId?: string | null,
): Promise<GeneratedReportWithSubjects | null> {
  const condition = schoolId
    ? and(eq(generatedStudentReports.id, id), eq(generatedStudentReports.schoolId, schoolId))
    : eq(generatedStudentReports.id, id)

  const [report] = await db
    .select()
    .from(generatedStudentReports)
    .where(condition)

  if (!report) return null

  const subjects = await db
    .select()
    .from(reportSubjectAnalytics)
    .where(eq(reportSubjectAnalytics.reportId, id))
    .orderBy(asc(reportSubjectAnalytics.subjectName))

  return { ...report, subjects }
}

export async function createGeneratedReport(
  payload: CreateReportPayload,
): Promise<GeneratedReportWithSubjects> {
  const {
    subjects = [],
    ...reportData
  } = payload

  // Insert report header
  const [report] = await db
    .insert(generatedStudentReports)
    .values({
      schoolId:                    reportData.schoolId,
      studentId:                   reportData.studentId,
      batchId:                     reportData.batchId ?? null,
      reportTitle:                 reportData.reportTitle,
      reportType:                  reportData.reportType  ?? 'COMPREHENSIVE',
      academicYear:                reportData.academicYear,
      term:                        reportData.term,
      overallPercentage:           reportData.overallPercentage  ?? '0%',
      overallGrade:                reportData.overallGrade        ?? 'N/A',
      classRank:                   reportData.classRank           ?? '-',
      batchRank:                   reportData.batchRank           ?? '-',
      attendancePercentage:        reportData.attendancePercentage       ?? 0,
      syllabusCoveragePercentage:  reportData.syllabusCoveragePercentage ?? 0,
      strengthAreas:               reportData.strengthAreas    ?? '',
      improvementAreas:            reportData.improvementAreas ?? '',
      teacherRemarks:              reportData.teacherRemarks   ?? '',
      principalRemarks:            reportData.principalRemarks ?? '',
      generatedBy:                 reportData.generatedBy ?? null,
      status:                      'DRAFT',
    })
    .returning()

  // Insert subject analytics rows
  let insertedSubjects: ReportSubjectAnalytics[] = []
  if (subjects.length > 0) {
    insertedSubjects = await db
      .insert(reportSubjectAnalytics)
      .values(subjects.map(s => ({
        reportId:               report.id,
        subjectName:            s.subjectName,
        marksObtained:          s.marksObtained,
        maxMarks:               s.maxMarks,
        grade:                  s.grade,
        totalChaptersTaught:    s.totalChaptersTaught    ?? 0,
        completedChaptersCount: s.completedChaptersCount ?? 0,
        conceptsMasteredCount:  s.conceptsMasteredCount  ?? 0,
        conceptsTotalCount:     s.conceptsTotalCount     ?? 0,
        subjectTeacherRemarks:  s.subjectTeacherRemarks  ?? '',
      })))
      .returning()
  }

  return { ...report, subjects: insertedSubjects }
}

export async function updateGeneratedReport(
  id: string,
  data: Partial<Omit<NewGeneratedStudentReport, 'id' | 'schoolId' | 'studentId' | 'createdAt'>>,
  schoolId?: string | null,
): Promise<GeneratedStudentReport | null> {
  const condition = schoolId
    ? and(eq(generatedStudentReports.id, id), eq(generatedStudentReports.schoolId, schoolId))
    : eq(generatedStudentReports.id, id)

  const [row] = await db
    .update(generatedStudentReports)
    .set({ ...data, updatedAt: new Date() })
    .where(condition)
    .returning()

  return row ?? null
}

export async function upsertReportSubjectAnalytics(
  reportId: string,
  subjects: SubjectAnalyticsPayload[],
): Promise<ReportSubjectAnalytics[]> {
  if (subjects.length === 0) return []

  return db
    .insert(reportSubjectAnalytics)
    .values(subjects.map(s => ({
      reportId,
      subjectName:            s.subjectName,
      marksObtained:          s.marksObtained,
      maxMarks:               s.maxMarks,
      grade:                  s.grade,
      totalChaptersTaught:    s.totalChaptersTaught    ?? 0,
      completedChaptersCount: s.completedChaptersCount ?? 0,
      conceptsMasteredCount:  s.conceptsMasteredCount  ?? 0,
      conceptsTotalCount:     s.conceptsTotalCount     ?? 0,
      subjectTeacherRemarks:  s.subjectTeacherRemarks  ?? '',
    })))
    .onConflictDoUpdate({
      target: [reportSubjectAnalytics.reportId, reportSubjectAnalytics.subjectName],
      set: {
        marksObtained:          sql`excluded.marks_obtained`,
        maxMarks:               sql`excluded.max_marks`,
        grade:                  sql`excluded.grade`,
        totalChaptersTaught:    sql`excluded.total_chapters_taught`,
        completedChaptersCount: sql`excluded.completed_chapters_count`,
        conceptsMasteredCount:  sql`excluded.concepts_mastered_count`,
        conceptsTotalCount:     sql`excluded.concepts_total_count`,
        subjectTeacherRemarks:  sql`excluded.subject_teacher_remarks`,
      },
    })
    .returning()
}

export async function deleteGeneratedReport(
  id: string,
  schoolId?: string | null,
): Promise<void> {
  const condition = schoolId
    ? and(eq(generatedStudentReports.id, id), eq(generatedStudentReports.schoolId, schoolId))
    : eq(generatedStudentReports.id, id)
  await db.delete(generatedStudentReports).where(condition)
}
