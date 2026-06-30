import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getReportById } from '@/lib/db/queries/student-reports'

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

    return NextResponse.json({
      _id: report.id,
      teacherName: report.teacherName,
      className: report.className,
      subject: report.subject,
      term: report.term,
      date: new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      entries: report.entries.map((e) => ({
        name: e.name,
        rollNo: e.rollNo,
        marks: e.marks,
        maxMarks: e.maxMarks,
        grade: e.grade,
        attendance: e.attendance,
        remarks: e.remarks,
      })),
    })
  } catch (err) {
    console.error('[student-reports/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
