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
      schoolId: studentReports.schoolId,
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
      studentReports.schoolId,
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

export interface DashboardFilters {
  teacherId?: string
  class?: string
  subject?: string
  term?: string
}

export interface TopPerformerRow {
  name: string
  rollNo: string
  className: string
  scorePercent: number
  reportId: string
}

export interface PerformanceTrendRow {
  term: string
  math: number
  science: number
}

export interface AttentionSubjectRow {
  subject: string
  avgPercent: number
}

export interface DashboardData {
  topPerformers: TopPerformerRow[]
  performanceTrends: PerformanceTrendRow[]
  attentionSubjects: AttentionSubjectRow[]
  distinctClasses: string[]
  distinctSubjects: string[]
  distinctTerms: string[]
}

interface ScopedEntryRow {
  reportId: string
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  className: string
  subject: string
  term: string
}

async function getScopedEntries(filters: DashboardFilters): Promise<ScopedEntryRow[]> {
  const conditions = []
  if (filters.teacherId) conditions.push(eq(studentReports.teacherId, filters.teacherId))
  if (filters.class) conditions.push(eq(studentReports.className, filters.class))
  if (filters.subject) conditions.push(eq(studentReports.subject, filters.subject))
  if (filters.term) conditions.push(eq(studentReports.term, filters.term))

  const baseQuery = db
    .select({
      reportId: studentReportEntries.reportId,
      name: studentReportEntries.name,
      rollNo: studentReportEntries.rollNo,
      marks: studentReportEntries.marks,
      maxMarks: studentReportEntries.maxMarks,
      className: studentReports.className,
      subject: studentReports.subject,
      term: studentReports.term,
    })
    .from(studentReportEntries)
    .innerJoin(studentReports, eq(studentReports.id, studentReportEntries.reportId))

  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions))
  }
  return baseQuery
}

function percentOf(entry: { marks: number; maxMarks: number }): number {
  return entry.maxMarks > 0 ? (entry.marks / entry.maxMarks) * 100 : 0
}

function isScienceSubject(subject: string): boolean {
  const s = subject.toLowerCase()
  return s.includes('science') || s.includes('physics') || s.includes('chemistry') || s.includes('biology')
}

export async function getDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  const entries = await getScopedEntries(filters)

  const bestByStudent = new Map<string, TopPerformerRow>()
  for (const e of entries) {
    const percent = percentOf(e)
    const key = `${e.name}|${e.rollNo}|${e.className}`
    const existing = bestByStudent.get(key)
    if (!existing || percent > existing.scorePercent) {
      bestByStudent.set(key, { name: e.name, rollNo: e.rollNo, className: e.className, scorePercent: percent, reportId: e.reportId })
    }
  }
  const topPerformers = Array.from(bestByStudent.values())
    .sort((a, b) => b.scorePercent - a.scorePercent)
    .slice(0, 5)

  const termStats: Record<string, { mathTotal: number; mathCount: number; sciTotal: number; sciCount: number }> = {}
  for (const e of entries) {
    if (!termStats[e.term]) termStats[e.term] = { mathTotal: 0, mathCount: 0, sciTotal: 0, sciCount: 0 }
    const percent = percentOf(e)
    if (e.subject.toLowerCase().includes('math')) {
      termStats[e.term].mathTotal += percent
      termStats[e.term].mathCount += 1
    } else if (isScienceSubject(e.subject)) {
      termStats[e.term].sciTotal += percent
      termStats[e.term].sciCount += 1
    }
  }
  const performanceTrends = Object.keys(termStats)
    .sort()
    .map((term) => {
      const s = termStats[term]
      return {
        term,
        math: s.mathCount > 0 ? Math.round(s.mathTotal / s.mathCount) : 0,
        science: s.sciCount > 0 ? Math.round(s.sciTotal / s.sciCount) : 0,
      }
    })

  const subjectStats: Record<string, { total: number; count: number }> = {}
  for (const e of entries) {
    if (!subjectStats[e.subject]) subjectStats[e.subject] = { total: 0, count: 0 }
    subjectStats[e.subject].total += percentOf(e)
    subjectStats[e.subject].count += 1
  }
  const attentionSubjects = Object.keys(subjectStats)
    .map((subject) => ({ subject, avgPercent: subjectStats[subject].total / subjectStats[subject].count }))
    .filter((s) => s.avgPercent < 65)

  const scopeConditions = []
  if (filters.teacherId) scopeConditions.push(eq(studentReports.teacherId, filters.teacherId))
  const distinctValuesQuery = db
    .select({ className: studentReports.className, subject: studentReports.subject, term: studentReports.term })
    .from(studentReports)
  const allReports =
    scopeConditions.length > 0 ? await distinctValuesQuery.where(and(...scopeConditions)) : await distinctValuesQuery

  return {
    topPerformers,
    performanceTrends,
    attentionSubjects,
    distinctClasses: Array.from(new Set(allReports.map((r) => r.className))).sort(),
    distinctSubjects: Array.from(new Set(allReports.map((r) => r.subject))).sort(),
    distinctTerms: Array.from(new Set(allReports.map((r) => r.term))).sort(),
  }
}
