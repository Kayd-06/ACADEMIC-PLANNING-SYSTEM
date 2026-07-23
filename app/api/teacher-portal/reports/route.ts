import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createReport, listReports, getReportById } from '@/lib/db/queries/student-reports'
import { formatDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

interface IncomingEntry {
  name: string
  rollNo?: string
  marks: number
  maxMarks?: number
  grade: string
  attendance?: number | null
  remarks?: string | null
}

// GET — the current teacher's own reports, for the "Recent Reports" table
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const summaries = await listReports({ schoolId: (session.user as any).schoolId, teacherId: session.user.id })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — upload a grading sheet (teacher only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can upload reports' }, { status: 403 })
    }

    const body = await req.json()
    const { className, subject, term, students } = body as {
      className: string
      subject: string
      term: string
      students: IncomingEntry[]
    }

    if (!className || !subject || !term || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or student data' }, { status: 400 })
    }

    const report = await createReport({
      schoolId: (session.user as any).schoolId,
      teacherId: session.user.id,
      teacherName: session.user.name ?? 'Faculty',
      className,
      subject,
      term,
      entries: students.map((s) => ({
        name: s.name,
        rollNo: s.rollNo ?? '',
        marks: s.marks,
        maxMarks: s.maxMarks ?? 100,
        grade: s.grade,
        attendance: s.attendance ?? null,
        remarks: s.remarks ?? null,
      })),
    })

    return NextResponse.json({ success: true, report }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
