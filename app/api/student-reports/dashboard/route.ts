import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listReports, getDashboardData } from '@/lib/db/queries/student-reports'
import { formatDate } from '@/lib/date'

export const dynamic = 'force-dynamic'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const classParam = url.searchParams.get('class') || undefined
    const subjectParam = url.searchParams.get('subject') || undefined
    const termParam = url.searchParams.get('term') || undefined
    const teacherId = session.user.role === 'teacher' ? session.user.id : undefined

    const filters = { teacherId, class: classParam, subject: subjectParam, term: termParam }

    const [reports, dashboard] = await Promise.all([listReports(filters), getDashboardData(filters)])

    const uploadedReports = reports.map((r) => ({
      _id: r.id,
      initials: initialsOf(r.teacherName),
      name: r.teacherName,
      className: r.className,
      subject: r.subject,
      term: r.term,
      date: formatDate(r.createdAt),
      students: r.studentCount,
      theme: 'blue',
    }))

    const topPerformers = dashboard.topPerformers.map((p, idx) => {
      let bg = ''
      if (idx === 0) bg = 'bg-[#0b1320] text-white'
      else if (idx === 1) bg = 'bg-indigo-100 text-indigo-700'
      else if (idx === 2) bg = 'bg-purple-100 text-purple-700'

      return {
        _id: `top-${idx}`,
        rank: idx + 1,
        name: p.name,
        className: p.className,
        score: `${p.scorePercent.toFixed(1)}%`,
        reportId: p.reportId,
        initials: idx < 3 ? initialsOf(p.name) : (idx + 1).toString(),
        bg,
      }
    })

    const attentionSubjects = dashboard.attentionSubjects.map((s, idx) => ({
      _id: `att-${idx}`,
      subject: s.subject,
      avg: `${s.avgPercent.toFixed(1)}%`,
      target: '65%',
      theme: s.avgPercent < 60 ? 'red' : 'amber',
    }))

    const performanceTrends = dashboard.performanceTrends.map((t, idx) => ({
      _id: `trend-${idx}`,
      label: t.term,
      math: t.math,
      science: t.science,
    }))

    return NextResponse.json(
      {
        performanceTrends,
        uploadedReports,
        topPerformers,
        attentionSubjects,
        filterOptions: {
          classes: dashboard.distinctClasses,
          subjects: dashboard.distinctSubjects,
          terms: dashboard.distinctTerms,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
