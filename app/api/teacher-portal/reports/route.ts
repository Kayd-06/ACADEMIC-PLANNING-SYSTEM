import { NextRequest, NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { listReports, getReportById } from '@/lib/db/queries/student-reports'
import { formatDate } from '@/lib/date'
import { POST as importStudentReport } from '@/app/api/student-reports/import/route'

export const dynamic = 'force-dynamic'

// GET — the current teacher's own reports, for the "Recent Reports" table
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = getSchoolId(session)
    if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

    const summaries = await listReports({ schoolId, teacherId: session.user.id })
    const detailed = await Promise.all(summaries.map((s) => getReportById(s.id)))

    const formatted = summaries.map((s, idx) => {
      const entries = detailed[idx]?.entries ?? []
      let totalMarks = 0
      let totalMax = 0
      entries.forEach((e) => {
        totalMarks += e.marks
        totalMax += e.maxMarks
      })
      const avgScore = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0

      return {
        _id: s.id,
        class: s.className,
        sub: s.subject,
        term: s.term,
        students: s.studentCount,
        avg: `${avgScore}%`,
        date: formatDate(s.createdAt),
      }
    })

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load reports' }, { status: 500 })
  }
}

// Backward-compatible alias for older clients. New imports use
// /api/student-reports/import for both management and teacher users.
export async function POST(req: NextRequest) {
  return importStudentReport(req)
}
