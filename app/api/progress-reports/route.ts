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

  // Link the actual student record when we can find them (chart: Identification — Student)
  let studentId: string | null = null
  const studentConditions: any[] = [eq(students.isActive, true)]
  if (schoolId) studentConditions.push(eq(students.schoolId, schoolId))
  const candidates = await db.select({ id: students.id, name: students.name, rollNo: students.rollNo })
    .from(students).where(and(...studentConditions))
  const match = candidates.find(s => (rollNo && s.rollNo === rollNo) || s.name.toLowerCase() === String(studentName).toLowerCase())
  if (match) studentId = match.id

  const [report] = await db.insert(progressReports).values({
    studentId,
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

// PATCH — edit a progress report (?id=) (management any, teacher their own).
// Accepts report fields and an optional full `subjects` array (replaces the breakdown
// and recomputes percentage/rank).
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  const schoolId = (session.user as any).schoolId as string | null

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const conditions = [eq(progressReports.id, id)]
  if (schoolId) conditions.push(eq(progressReports.schoolId, schoolId))
  if (role === 'teacher') conditions.push(eq(progressReports.teacherEmail, session.user.email!))
  else if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [existing] = await db.select().from(progressReports).where(and(...conditions))
  if (!existing) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const body = await req.json()
  const updates: Record<string, any> = {}
  for (const f of ['studentName', 'rollNo', 'batch', 'termType', 'academicYear', 'teacherRemarks', 'principalRemarks'] as const) {
    if (body[f] !== undefined) updates[f] = body[f]
  }

  if (Array.isArray(body.subjects)) {
    let totalObtained = 0
    let totalMax = 0
    for (const sub of body.subjects) {
      totalObtained += Number(sub.marksObtained) || 0
      totalMax += Number(sub.totalMarks) || 100
    }
    const percentageVal = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0
    updates.percentage = `${percentageVal}%`
    updates.rank = percentageVal >= 90 ? '1st' : percentageVal >= 80 ? '2nd' : percentageVal >= 70 ? '3rd' : '-'

    await db.delete(progressReportSubjects).where(eq(progressReportSubjects.progressReportId, id))
    if (body.subjects.length > 0) {
      await db.insert(progressReportSubjects).values(body.subjects.map((sub: any) => ({
        progressReportId: id,
        subjectName: sub.subjectName || 'General',
        marksObtained: Number(sub.marksObtained) || 0,
        totalMarks: Number(sub.totalMarks) || 100,
        grade: sub.grade || (Number(sub.marksObtained) >= 90 ? 'A+' : Number(sub.marksObtained) >= 80 ? 'A' : 'B'),
        rankInBatch: sub.rankInBatch || '-',
      })))
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  updates.updatedAt = new Date()

  const [updated] = await db.update(progressReports).set(updates).where(eq(progressReports.id, id)).returning()
  const updatedSubjects = await db.select().from(progressReportSubjects).where(eq(progressReportSubjects.progressReportId, id))
  return NextResponse.json({ ...updated, subjects: updatedSubjects })
}

// DELETE — remove a progress report (?id=) (management any, teacher their own; subjects cascade)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  const schoolId = (session.user as any).schoolId as string | null

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const conditions = [eq(progressReports.id, id)]
  if (schoolId) conditions.push(eq(progressReports.schoolId, schoolId))
  if (role === 'teacher') conditions.push(eq(progressReports.teacherEmail, session.user.email!))
  else if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.delete(progressReports).where(and(...conditions))
  return NextResponse.json({ success: true })
}
