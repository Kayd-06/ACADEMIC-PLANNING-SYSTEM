import { eq, and, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  studentReports,
  studentReportEntries,
  type StudentReport,
  type StudentReportEntry,
} from '../schema'

export interface ReportEntryInput {
  name: string
  rollNo?: string
  marks: number
  maxMarks?: number
  grade: string
  attendance?: number | null
  remarks?: string | null
}

export interface CreateReportInput {
  teacherId: string
  teacherName: string
  className: string
  subject: string
  term: string
  entries: ReportEntryInput[]
}

export interface ReportWithEntries extends StudentReport {
  entries: StudentReportEntry[]
}

export interface ListReportsFilters {
  teacherId?: string
  class?: string
  subject?: string
  term?: string
}

export interface StudentReportSummary extends StudentReport {
  studentCount: number
}

export async function createReport(data: CreateReportInput): Promise<ReportWithEntries> {
  const [report] = await db
    .insert(studentReports)
    .values({
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      className: data.className,
      subject: data.subject,
      term: data.term,
    })
    .returning()

  if (data.entries.length === 0) {
    return { ...report, entries: [] }
  }

  const entries = await db
    .insert(studentReportEntries)
    .values(
      data.entries.map((e) => ({
        reportId: report.id,
        name: e.name,
        rollNo: e.rollNo ?? '',
        marks: e.marks,
        maxMarks: e.maxMarks ?? 100,
        grade: e.grade,
        attendance: e.attendance ?? null,
        remarks: e.remarks ?? null,
      }))
    )
    .returning()

  return { ...report, entries }
}

export async function listReports(filters: ListReportsFilters = {}): Promise<StudentReportSummary[]> {
  const conditions = []
  if (filters.teacherId) conditions.push(eq(studentReports.teacherId, filters.teacherId))
  if (filters.class) conditions.push(eq(studentReports.className, filters.class))
  if (filters.subject) conditions.push(eq(studentReports.subject, filters.subject))
  if (filters.term) conditions.push(eq(studentReports.term, filters.term))

  const baseQuery = db
    .select({
      id: studentReports.id,
      teacherId: studentReports.teacherId,
      teacherName: studentReports.teacherName,
      className: studentReports.className,
      subject: studentReports.subject,
      term: studentReports.term,
      createdAt: studentReports.createdAt,
      studentCount: sql<number>`count(${studentReportEntries.id})::int`,
    })
    .from(studentReports)
    .leftJoin(studentReportEntries, eq(studentReportEntries.reportId, studentReports.id))
    .groupBy(
      studentReports.id,
      studentReports.teacherId,
      studentReports.teacherName,
      studentReports.className,
      studentReports.subject,
      studentReports.term,
      studentReports.createdAt
    )
    .orderBy(studentReports.createdAt)

  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions))
  }
  return baseQuery
}

export async function getReportById(id: string): Promise<ReportWithEntries | null> {
  const rows = await db.select().from(studentReports).where(eq(studentReports.id, id))
  const report = rows[0]
  if (!report) return null
  const entries = await db.select().from(studentReportEntries).where(eq(studentReportEntries.reportId, id))
  return { ...report, entries }
}
