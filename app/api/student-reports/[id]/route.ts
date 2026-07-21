import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getReportById } from '@/lib/db/queries/student-reports'
import { computeStudentAttendance, computeAssignmentAverage } from '@/lib/db/queries/attendance'
import { computeTestPerformance } from '@/lib/db/queries/tests'
import { getLocalToday } from '@/lib/scheduleUtils'
import { formatDate } from '@/lib/date'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const report = await getReportById(id)
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (session.user.role === 'teacher' && report.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Resolve each entry's roll number to the real student record so we can
    // compute their live attendance % and assignment average, rather than
    // only showing the marks captured at upload time for this one report.
    const schoolId = report.schoolId
    const rollNos = report.entries.map((e) => e.rollNo).filter(Boolean)
    const studentCond = [eq(students.class, report.className)]
    if (schoolId) studentCond.push(eq(students.schoolId, schoolId))
    const classStudents = rollNos.length ? await db.select().from(students).where(and(...studentCond)) : []
    const studentByRoll = new Map(classStudents.map((s) => [s.rollNo, s]))

    const todayIso = getLocalToday()
    const entries = await Promise.all(report.entries.map(async (e) => {
      const student = e.rollNo ? studentByRoll.get(e.rollNo) : undefined
      const [attendanceStats, assignmentStats, testPerformance] = student
        ? await Promise.all([
            computeStudentAttendance(student.id, student.batch, schoolId, todayIso),
            computeAssignmentAverage(student.id),
            computeTestPerformance(student.id, schoolId),
          ])
        : [null, null, []]

      const gradedTests = testPerformance.filter(t => !t.absent && t.percentage !== null)
      const testAverage = gradedTests.length > 0
        ? Math.round(gradedTests.reduce((sum, t) => sum + (t.percentage as number), 0) / gradedTests.length)
        : null

      return {
        name: e.name,
        rollNo: e.rollNo,
        marks: e.marks,
        maxMarks: e.maxMarks,
        grade: e.grade,
        attendance: attendanceStats ? attendanceStats.percentage : e.attendance,
        attendanceDetail: attendanceStats ? `${attendanceStats.presentCount}/${attendanceStats.totalClasses}` : null,
        assignmentAverage: assignmentStats ? assignmentStats.average : null,
        assignmentGradedCount: assignmentStats ? assignmentStats.gradedCount : 0,
        testAverage,
        testCount: gradedTests.length,
        remarks: e.remarks,
      }
    }))

    return NextResponse.json({
      _id: report.id,
      teacherName: report.teacherName,
      className: report.className,
      subject: report.subject,
      term: report.term,
      date: formatDate(report.createdAt),
      entries,
    })
  } catch (err) {
    console.error('[student-reports/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
