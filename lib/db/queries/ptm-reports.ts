import { eq, and, desc } from 'drizzle-orm'
import { db } from '../index'
import { ptmReports, students, type PtmReport } from '../schema'

export interface SavePtmReportInput {
  studentId: string
  batch?: string
  date: string
  parentName?: string
  parentAttended: boolean
  discussionNotes: string
  actionItems: string
  followUpDate?: string
  facultyId?: string | null
  schoolId?: string | null
  batchId?: string | null
}

export async function savePtmReport(input: SavePtmReportInput) {
  const [report] = await db
    .insert(ptmReports)
    .values({
      studentId: input.studentId,
      batch: input.batch ?? null,
      date: input.date,
      parentName: input.parentName ?? null,
      parentAttended: input.parentAttended,
      discussionNotes: input.discussionNotes,
      actionItems: input.actionItems,
      followUpDate: input.followUpDate ?? null,
      facultyId: input.facultyId ?? null,
      schoolId: input.schoolId ?? null,
      batchId: input.batchId ?? null,
    })
    .returning()
  return report
}

export async function listPtmReports(filters: { studentId?: string; batch?: string; schoolId?: string | null }) {
  const conditions = []
  if (filters.studentId) conditions.push(eq(ptmReports.studentId, filters.studentId))
  if (filters.batch) conditions.push(eq(ptmReports.batch, filters.batch))
  if (filters.schoolId) conditions.push(eq(ptmReports.schoolId, filters.schoolId))

  const baseQuery = db
    .select({
      id: ptmReports.id,
      studentId: ptmReports.studentId,
      studentName: students.name,
      rollNo: students.rollNo,
      batch: ptmReports.batch,
      date: ptmReports.date,
      parentName: ptmReports.parentName,
      parentAttended: ptmReports.parentAttended,
      discussionNotes: ptmReports.discussionNotes,
      actionItems: ptmReports.actionItems,
      followUpDate: ptmReports.followUpDate,
      createdAt: ptmReports.createdAt,
    })
    .from(ptmReports)
    .innerJoin(students, eq(ptmReports.studentId, students.id))

  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions)).orderBy(desc(ptmReports.date))
  }
  return baseQuery.orderBy(desc(ptmReports.date))
}

export async function getStudentPtmSummary(studentId: string, schoolId?: string | null) {
  const conditions = [eq(ptmReports.studentId, studentId)]
  if (schoolId) conditions.push(eq(ptmReports.schoolId, schoolId))

  const reports = await db
    .select()
    .from(ptmReports)
    .where(and(...conditions))
    .orderBy(desc(ptmReports.date))

  const totalMeetings = reports.length
  const parentsAttendedCount = reports.filter(r => r.parentAttended).length
  const attendanceRate = totalMeetings > 0 ? Math.round((parentsAttendedCount / totalMeetings) * 100) : 0

  return {
    totalMeetings,
    parentsAttendedCount,
    attendanceRate,
    ptmList: reports,
  }
}
