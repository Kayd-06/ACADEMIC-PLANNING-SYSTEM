import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStudentById } from '@/lib/db/queries/students'
import { db } from '@/lib/db'
import { counselingSessions, studentReports, studentReportEntries, parentsGuardians, studentBatchEnrollments } from '@/lib/db/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { computeStudentAttendance } from '@/lib/db/queries/attendance'
import { getLocalToday } from '@/lib/scheduleUtils'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { id } = await params
    const student = await getStudentById(id)

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const [guardians, enrollments] = await Promise.all([
      db.select().from(parentsGuardians)
        .where(eq(parentsGuardians.studentId, id))
        .orderBy(desc(parentsGuardians.isPrimary), asc(parentsGuardians.createdAt)),
      db.select().from(studentBatchEnrollments)
        .where(eq(studentBatchEnrollments.studentId, id))
        .orderBy(desc(studentBatchEnrollments.createdAt)),
    ])

    // Find report entries matching this student by rollNo
    const entries = await db
      .select({
        marks: studentReportEntries.marks,
        maxMarks: studentReportEntries.maxMarks,
        subject: studentReports.subject,
        term: studentReports.term,
        createdAt: studentReports.createdAt,
      })
      .from(studentReportEntries)
      .innerJoin(studentReports, eq(studentReportEntries.reportId, studentReports.id))
      .where(eq(studentReportEntries.rollNo, student.rollNo ?? ''))
      .orderBy(desc(studentReports.createdAt))

    const recentTests = entries.map(e => ({
      test: `${e.term} - ${e.subject}`,
      date: new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: `${e.marks}/${e.maxMarks}`,
      percentage: Math.round((e.marks / e.maxMarks) * 100),
    }))

    const subjectAverages: Record<string, { total: number; count: number }> = {}
    for (const e of entries) {
      if (!subjectAverages[e.subject]) subjectAverages[e.subject] = { total: 0, count: 0 }
      subjectAverages[e.subject].total += (e.marks / e.maxMarks) * 100
      subjectAverages[e.subject].count += 1
    }

    const currentPerformance = Object.entries(subjectAverages).map(([subject, { total, count }]) => ({
      subject,
      average: Math.round(total / count),
    }))

    const counseling = await db
      .select()
      .from(counselingSessions)
      .where(eq(counselingSessions.studentName, student.name))
      .orderBy(desc(counselingSessions.date))

    const counselingNotes = counseling.map((c: any) => ({
      date: new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      notes: c.notes || `Counseling session with ${c.counselor}`,
    }))

    const attendanceStats = await computeStudentAttendance(student.id, student.batch, schoolId, getLocalToday())

    return NextResponse.json({
      student,
      guardians,
      enrollments,
      recentTests,
      currentPerformance,
      counselingNotes,
      attendance: attendanceStats.percentage,
      attendanceDays: `${attendanceStats.presentCount}/${attendanceStats.totalClasses}`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
