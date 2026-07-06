// API route for progress reports - verified
import { NextRequest, NextResponse } from 'next/server'
import { db, progressReports, progressReportSubjects, students } from '@/lib/db'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batch = searchParams.get('batch')
  const termType = searchParams.get('termType') || 'Mid-Term'
  const academicYear = searchParams.get('academicYear') || '2025-2026'
  const schoolId = (session.user as any).schoolId as string | null

  const conditions: any[] = []
  if (schoolId) conditions.push(eq(progressReports.schoolId, schoolId))
  if (batch && batch !== 'All') conditions.push(eq(progressReports.batch, batch))
  if (termType && termType !== 'All') conditions.push(eq(progressReports.termType, termType))
  if (academicYear) conditions.push(eq(progressReports.academicYear, academicYear))

  const reports = conditions.length
    ? await db.select().from(progressReports).where(and(...conditions)).orderBy(desc(progressReports.generatedAt))
    : await db.select().from(progressReports).orderBy(desc(progressReports.generatedAt))

  if (reports.length === 0) {
    return NextResponse.json([])
  }

  const reportIds = reports.map(r => r.id)
  const subjects = await db.select().from(progressReportSubjects).where(inArray(progressReportSubjects.progressReportId, reportIds))

  const subjectsMap = new Map<string, any[]>()
  for (const sub of subjects) {
    const list = subjectsMap.get(sub.progressReportId) || []
    list.push(sub)
    subjectsMap.set(sub.progressReportId, list)
  }

  const combined = reports.map(r => ({
    ...r,
    subjects: subjectsMap.get(r.id) || []
  }))

  return NextResponse.json(combined)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { studentName, rollNo, batch, termType, academicYear, teacherRemarks, principalRemarks, subjects } = body
  const schoolId = (session.user as any).schoolId as string | null

  if (!studentName || !batch) {
    return NextResponse.json({ error: 'studentName and batch are required' }, { status: 400 })
  }

  // Calculate overall percentage and rank
  let totalObtained = 0
  let totalMax = 0
  if (Array.isArray(subjects)) {
    for (const sub of subjects) {
      totalObtained += Number(sub.marksObtained) || 0
      totalMax += Number(sub.totalMarks) || 100
    }
  }
  const percentageVal = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0
  const percentageStr = `${percentageVal}%`
  const rankStr = percentageVal >= 90 ? '1st' : percentageVal >= 80 ? '2nd' : percentageVal >= 70 ? '3rd' : '-'

  const [report] = await db.insert(progressReports).values({
    studentName,
    rollNo: rollNo || '',
    batch,
    termType: termType || 'Mid-Term',
    academicYear: academicYear || '2025-2026',
    percentage: percentageStr,
    rank: rankStr,
    teacherRemarks: teacherRemarks || '',
    principalRemarks: principalRemarks || '',
    teacherName: session.user.name ?? 'Faculty',
    teacherEmail: session.user.email || '',
    schoolId,
  }).returning()

  if (Array.isArray(subjects) && subjects.length > 0) {
    const subValues = subjects.map((sub: any) => ({
      progressReportId: report.id,
      subjectName: sub.subjectName || 'General',
      marksObtained: Number(sub.marksObtained) || 0,
      totalMarks: Number(sub.totalMarks) || 100,
      grade: sub.grade || (Number(sub.marksObtained) >= 90 ? 'A+' : Number(sub.marksObtained) >= 80 ? 'A' : 'B'),
      rankInBatch: sub.rankInBatch || '-'
    }))
    await db.insert(progressReportSubjects).values(subValues)
  }

  return NextResponse.json(report, { status: 201 })
}
