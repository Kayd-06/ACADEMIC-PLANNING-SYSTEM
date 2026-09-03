import { NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { listReports } from '@/lib/db/queries/student-reports'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = getSchoolId(session)
    if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

    const reports = await listReports({
      schoolId,
      teacherId: session.user.role === 'teacher' ? session.user.id : undefined,
    })

    const formatted = reports.map((r) => ({
      _id: r.id,
      teacherName: r.teacherName,
      className: r.className,
      subject: r.subject,
      term: r.term,
      studentCount: r.studentCount,
      createdAt: r.createdAt,
    }))

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (err) {
    console.error('[student-reports GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
