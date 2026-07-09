import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listReports } from '@/lib/db/queries/student-reports'

export const dynamic = 'force-dynamic'

export async function GET(req?: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const reports =
      session.user.role === 'management'
        ? await listReports()
        : await listReports({ teacherId: session.user.id })

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
