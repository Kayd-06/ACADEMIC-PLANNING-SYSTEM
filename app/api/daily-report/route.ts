// Daily report API route - updated and verified
import { NextRequest, NextResponse } from 'next/server'
import { db, dailyReports, students } from '@/lib/db'
import { eq, and, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function isLateSubmission(reportDate: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (reportDate < today) return true
  if (reportDate === today) {
    const hour = new Date().getHours()
    return hour >= 20
  }
  return false
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const schoolId = (session.user as any).schoolId as string | null

  let reports
  if ((session.user as any).role === 'teacher') {
    const conditions = [eq(dailyReports.teacherEmail, session.user.email!)]
    if (schoolId) conditions.push(eq(dailyReports.schoolId, schoolId))
    if (date) conditions.push(eq(dailyReports.date, date))
    reports = await db.select().from(dailyReports).where(and(...conditions)).orderBy(desc(dailyReports.submittedAt))
  } else {
    const conditions: any[] = []
    if (schoolId) conditions.push(eq(dailyReports.schoolId, schoolId))
    if (date) conditions.push(eq(dailyReports.date, date))
    reports = conditions.length
      ? await db.select().from(dailyReports).where(and(...conditions)).orderBy(desc(dailyReports.submittedAt))
      : await db.select().from(dailyReports).orderBy(desc(dailyReports.submittedAt))
  }

  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, batch, subject, chapter, topicsCovered, presentCount, absentCount, homeworkGiven, observations } = body
  const schoolId = (session.user as any).schoolId as string | null

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
    schoolId,
  }).returning()

  return NextResponse.json(report, { status: 201 })
}

// GET distinct batches from students table
export async function PUT() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const baseCondition = and(
    eq(students.isActive, true),
    ...(schoolId ? [eq(students.schoolId, schoolId)] : [])
  )
  const rows = await db.selectDistinct({ class: students.class }).from(students).where(baseCondition)
  const batches = rows.map(r => r.class).filter(Boolean).sort()
  return NextResponse.json(batches)
}
