import { eq, and, inArray, lte } from 'drizzle-orm'
import { db } from '../index'
import {
  classSchedules, specialClasses, attendanceSessions, attendanceEntries,
  assignments, assignmentSubmissions,
} from '../schema'

export interface AttendanceStats {
  totalClasses: number
  presentCount: number
  percentage: number
}

const ATTENDED_STATUSES = ['Present', 'Late', 'Excused']

// A recurring weekly slot doesn't store every date it ran on — only its
// dayOfWeek and an optional effective range. Expand it into the actual
// calendar dates it covers, bounded by when the slot was created (it can't
// have run before that) through effectiveTo or `uptoDateIso`, whichever is
// sooner.
function expandWeeklyDates(dayOfWeek: number, fromIso: string, toIso: string): string[] {
  const dates: string[] = []
  const from = new Date(`${fromIso}T00:00:00Z`)
  const to = new Date(`${toIso}T00:00:00Z`)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return dates

  const d = new Date(from)
  const diff = (dayOfWeek - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + diff)
  while (d <= to) {
    dates.push(d.toISOString().split('T')[0])
    d.setUTCDate(d.getUTCDate() + 7)
  }
  return dates
}

// Counts every class session scheduled for this batch up to `uptoDateIso`
// (recurring classSchedules expanded across their date range, plus every
// specialClasses row), and how many of them this student has a Present/
// Late/Excused attendanceEntries row for. A scheduled session with no
// attendanceSessions row at all — the teacher never marked it — counts
// toward the total but not toward present, i.e. it's treated as absent.
export async function computeStudentAttendance(
  studentId: string,
  batch: string,
  schoolId: string | null,
  uptoDateIso: string
): Promise<AttendanceStats> {
  if (!studentId || !batch) return { totalClasses: 0, presentCount: 0, percentage: 0 }

  const schedCond = [eq(classSchedules.batch, batch), eq(classSchedules.isActive, true)]
  if (schoolId) schedCond.push(eq(classSchedules.schoolId, schoolId))
  const schedules = await db.select().from(classSchedules).where(and(...schedCond))

  const specCond = [eq(specialClasses.batch, batch), lte(specialClasses.date, uptoDateIso)]
  if (schoolId) specCond.push(eq(specialClasses.schoolId, schoolId))
  const specials = await db.select().from(specialClasses).where(and(...specCond))

  type Occurrence = { date: string; scheduleId: string | null; specialClassId: string | null }
  const occurrences: Occurrence[] = []

  for (const s of schedules) {
    const fromIso = s.effectiveFrom || s.createdAt.toISOString().split('T')[0]
    const toIso = s.effectiveTo && s.effectiveTo < uptoDateIso ? s.effectiveTo : uptoDateIso
    for (const date of expandWeeklyDates(s.dayOfWeek, fromIso, toIso)) {
      occurrences.push({ date, scheduleId: s.id, specialClassId: null })
    }
  }
  for (const sc of specials) {
    occurrences.push({ date: sc.date, scheduleId: null, specialClassId: sc.id })
  }

  if (occurrences.length === 0) return { totalClasses: 0, presentCount: 0, percentage: 0 }

  const sessionCond = [eq(attendanceSessions.batch, batch)]
  if (schoolId) sessionCond.push(eq(attendanceSessions.schoolId, schoolId))
  const sessions = await db.select().from(attendanceSessions).where(and(...sessionCond))

  const sessionByScheduleDate = new Map(
    sessions.filter(s => s.scheduleId).map(s => [`${s.scheduleId}|${s.date}`, s])
  )
  const sessionBySpecial = new Map(
    sessions.filter(s => s.specialClassId).map(s => [s.specialClassId as string, s])
  )

  const sessionIds = sessions.map(s => s.id)
  const entries = sessionIds.length
    ? await db.select().from(attendanceEntries)
        .where(and(eq(attendanceEntries.studentId, studentId), inArray(attendanceEntries.sessionId, sessionIds)))
    : []
  const entryBySession = new Map(entries.map(e => [e.sessionId, e]))

  let presentCount = 0
  for (const occ of occurrences) {
    const session = occ.scheduleId
      ? sessionByScheduleDate.get(`${occ.scheduleId}|${occ.date}`)
      : sessionBySpecial.get(occ.specialClassId as string)
    if (!session) continue
    const entry = entryBySession.get(session.id)
    if (entry && ATTENDED_STATUSES.includes(entry.status)) presentCount++
  }

  const totalClasses = occurrences.length
  return {
    totalClasses,
    presentCount,
    percentage: totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0,
  }
}

export interface AssignmentAverage {
  average: number
  gradedCount: number
}

// Average percentage across every graded assignment submission for this
// student (marksObtained / the assignment's totalMarks).
export async function computeAssignmentAverage(studentId: string): Promise<AssignmentAverage> {
  if (!studentId) return { average: 0, gradedCount: 0 }

  const rows = await db.select({
    marksObtained: assignmentSubmissions.marksObtained,
    totalMarks: assignments.totalMarks,
  })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
    .where(and(eq(assignmentSubmissions.studentId, studentId), eq(assignmentSubmissions.status, 'Graded')))

  if (rows.length === 0) return { average: 0, gradedCount: 0 }

  const pct = rows.reduce((sum, r) => sum + ((r.marksObtained ?? 0) / (r.totalMarks || 100)) * 100, 0) / rows.length
  return { average: Math.round(pct), gradedCount: rows.length }
}
