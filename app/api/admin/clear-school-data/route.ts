import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isAdminOfSchool } from '@/lib/db/queries/adminSchools'
import { getSchoolById } from '@/lib/db/queries/school'
import { eq } from 'drizzle-orm'
import {
  students, classSchedules, specialClasses, attendanceSessions, calendarEvents,
  counselingSessions, studentReports, faculty, studyMaterials, dailyReports,
  progressReports, assignments, feedback, announcements, notifications,
  recruitmentRequirements, recruitmentCandidates, recruitmentInterviews,
  teacherAppraisals, auditLogs, tests, questions,
} from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

// Every table scoped by school_id that "Clear All Data" wipes.
// Deliberately excludes: schools, users, admin_schools, school_invites,
// email_verifications — accounts and school membership are never touched.
// Child rows (parents_guardians, attendance_entries, progress_report_subjects,
// teacher_subjects, teacher_batches, assignment_submissions, etc.) cascade
// automatically when their parent row is deleted.
const CLEARABLE = [
  { label: 'Students & guardians', table: students },
  { label: 'Class schedules', table: classSchedules },
  { label: 'Special classes', table: specialClasses },
  { label: 'Attendance records', table: attendanceSessions },
  { label: 'Calendar events', table: calendarEvents },
  { label: 'Counseling sessions', table: counselingSessions },
  { label: 'Student reports', table: studentReports },
  { label: 'Faculty', table: faculty },
  { label: 'Study materials', table: studyMaterials },
  { label: 'Daily reports', table: dailyReports },
  { label: 'Progress reports', table: progressReports },
  { label: 'Assignments', table: assignments },
  { label: 'Feedback', table: feedback },
  { label: 'Announcements', table: announcements },
  { label: 'Notifications', table: notifications },
  { label: 'Recruitment requirements', table: recruitmentRequirements },
  { label: 'Recruitment candidates', table: recruitmentCandidates },
  { label: 'Recruitment interviews', table: recruitmentInterviews },
  { label: 'Teacher appraisals', table: teacherAppraisals },
  { label: 'Audit logs', table: auditLogs },
  { label: 'Tests', table: tests },
  { label: 'Question bank', table: questions },
] as const

async function guard() {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((session.user as any).role !== 'management') {
    return { error: NextResponse.json({ error: 'Only management can clear school data' }, { status: 403 }) }
  }
  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return { error: NextResponse.json({ error: 'No active school selected' }, { status: 400 }) }

  const membership = await isAdminOfSchool(session.user.id!, schoolId)
  if (membership?.role !== 'owner') {
    return { error: NextResponse.json({ error: 'Only the school owner can clear all data' }, { status: 403 }) }
  }
  return { session, schoolId }
}

// GET — preview counts per table for the confirmation screen
export async function GET() {
  const g = await guard()
  if ('error' in g) return g.error

  const counts = await Promise.all(
    CLEARABLE.map(async ({ label, table }) => {
      const rows = await db.select({ id: (table as any).id }).from(table as any).where(eq((table as any).schoolId, g.schoolId))
      return { label, count: rows.length }
    })
  )
  const school = await getSchoolById(g.schoolId)
  return NextResponse.json({ schoolName: school?.name ?? 'this school', counts, total: counts.reduce((s, c) => s + c.count, 0) })
}

// DELETE — wipe every clearable table for the active school.
// Body: { confirmText } must exactly match the school's name.
export async function DELETE(req: NextRequest) {
  const g = await guard()
  if ('error' in g) return g.error

  const school = await getSchoolById(g.schoolId)
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (body.confirmText !== school.name) {
    return NextResponse.json({ error: 'Confirmation text does not match the school name' }, { status: 400 })
  }

  const results: Record<string, number> = {}
  for (const { label, table } of CLEARABLE) {
    const deleted = await db.delete(table as any).where(eq((table as any).schoolId, g.schoolId)).returning({ id: (table as any).id })
    results[label] = deleted.length
  }

  return NextResponse.json({ success: true, deleted: results })
}
