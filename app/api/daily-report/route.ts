import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dailyReports, students } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function isLateSubmission(reportDate: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (reportDate < today) return true
  if (reportDate === today) {
    const hour = new Date().getHours()
    return hour >= 20 // after 8 PM is late
  }
  return false
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  let query
  if ((session.user as any).role === 'teacher') {
    query = date
      ? db.select().from(dailyReports).where(and(eq(dailyReports.teacherEmail, session.user.email!), eq(dailyReports.date, date))).orderBy(desc(dailyReports.submittedAt))
      : db.select().from(dailyReports).where(eq(dailyReports.teacherEmail, session.user.email!)).orderBy(desc(dailyReports.submittedAt))
  } else {
    query = date
      ? db.select().from(dailyReports).where(eq(dailyReports.date, date)).orderBy(desc(dailyReports.submittedAt))
      : db.select().from(dailyReports).orderBy(desc(dailyReports.submittedAt))
  }

  const reports = await query
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, batch, subject, chapter, topicsCovered, presentCount, absentCount, homeworkGiven, observations } = body

  if (!date || !batch || !subject) {
    return NextResponse.json({ error: 'date, batch, and subject are required' }, { status: 400 })
  }

  const isLate = isLateSubmission(date)

  const [report] = await db.insert(dailyReports).values({
    teacherName: session.user.name ?? 'Faculty',
    teacherEmail: session.user.email!,
    date,
    batch,
    subject,
    chapter: chapter || '',
    topicsCovered: topicsCovered || '',
    presentCount: Number(presentCount) || 0,
    absentCount: Number(absentCount) || 0,
    homeworkGiven: homeworkGiven || '',
    observations: observations || '',
    isLate,
  }).returning()

  return NextResponse.json(report, { status: 201 })
}

// GET distinct batches from students table
export async function PUT() {
  const rows = await db.selectDistinct({ class: students.class }).from(students).where(eq(students.isActive, true))
  const batches = rows.map(r => r.class).filter(Boolean).sort()
  return NextResponse.json(batches)
}
