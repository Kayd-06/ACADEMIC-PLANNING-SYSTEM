// API route for progress reports with True Dynamic Batch & Term Ranking
import { NextRequest, NextResponse } from 'next/server'
import { db, progressReports, progressReportSubjects, students } from '@/lib/db'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper function to turn a numeric rank (1, 2, 3...) into ordinal ('1st', '2nd', '3rd', '4th'...)
function getOrdinalRank(n: number, total: number): string {
  if (n <= 0) return '-'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  const suffix = (s[(v - 20) % 10] || s[v] || s[0])
  return total > 1 ? `${n}${suffix} / ${total}` : `${n}${suffix}`
}

// Helper: Dynamically recalculate and update ranks for all students inside a specific batch + termType + academicYear
async function recomputeBatchRanks(batch: string, termType: string, academicYear: string, schoolId: string | null) {
  try {
    const conditions = [
      eq(progressReports.batch, batch),
      eq(progressReports.termType, termType),
      eq(progressReports.academicYear, academicYear)
    ]
    if (schoolId) conditions.push(eq(progressReports.schoolId, schoolId))

    const allReportsInBatch = await db.select().from(progressReports).where(and(...conditions))
    if (allReportsInBatch.length === 0) return

    // Sort descending by percentage numeric value (e.g., parseInt("82%") -> 82)
    const sorted = [...allReportsInBatch].sort((a, b) => {
      const pctA = parseInt(a.percentage || '0', 10) || 0
      const pctB = parseInt(b.percentage || '0', 10) || 0
      return pctB - pctA
    })

    const totalStudents = sorted.length
    for (let i = 0; i < sorted.length; i++) {
      const rankOrdinal = getOrdinalRank(i + 1, totalStudents)
      if (sorted[i].rank !== rankOrdinal) {
        await db.update(progressReports)
          .set({ rank: rankOrdinal })
          .where(eq(progressReports.id, sorted[i].id))
      }
    }
  } catch (err) {
    console.error('Error recomputing batch ranks:', err)
  }
}

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
  if (academicYear && academicYear !== 'All') conditions.push(eq(progressReports.academicYear, academicYear))

  const reports = conditions.length
    ? await db.select().from(progressReports).where(and(...conditions)).orderBy(desc(progressReports.generatedAt))
    : await db.select().from(progressReports).orderBy(desc(progressReports.generatedAt))

  if (reports.length === 0) {
    return NextResponse.json([])
  }

  // Ensure all fetched reports have exact dynamically computed true rank in their cohort
  // Group reports by batch + termType + academicYear to recalculate on the fly if needed
  const cohortGroups = new Map<string, typeof reports>()
  for (const r of reports) {
    const key = `${r.batch}:::${r.termType}:::${r.academicYear}`
    const list = cohortGroups.get(key) || []
    list.push(r)
    cohortGroups.set(key, list)
  }

  for (const [key, cohortList] of cohortGroups.entries()) {
    const [b, t, a] = key.split(':::')
    // Check if we need to sync ranks in DB or just update in memory
    const sortedCohort = [...cohortList].sort((x, y) => {
      const px = parseInt(x.percentage || '0', 10) || 0
      const py = parseInt(y.percentage || '0', 10) || 0
      return py - px
    })
    const total = sortedCohort.length
    for (let i = 0; i < sortedCohort.length; i++) {
      const trueRank = getOrdinalRank(i + 1, total)
      sortedCohort[i].rank = trueRank
      // Asynchronously sync correct rank if DB had stale or static rank
      if (sortedCohort[i].rank !== trueRank || trueRank.includes('2nd') && total === 1) {
        db.update(progressReports).set({ rank: trueRank }).where(eq(progressReports.id, sortedCohort[i].id)).catch(() => {})
      }
    }
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

  // Calculate overall percentage
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

  // Check how many students exist in this cohort right now to assign initial true rank
  const cohortConditions = [
    eq(progressReports.batch, batch),
    eq(progressReports.termType, termType || 'Mid-Term'),
    eq(progressReports.academicYear, academicYear || '2025-2026')
  ]
  if (schoolId) cohortConditions.push(eq(progressReports.schoolId, schoolId))
  const existingCohort = await db.select().from(progressReports).where(and(...cohortConditions))
  
  // Compute rank dynamically against cohort
  const allScores = [...existingCohort.map(r => parseInt(r.percentage || '0', 10)), percentageVal].sort((a, b) => b - a)
  const myRankIdx = allScores.indexOf(percentageVal) + 1
  const rankStr = getOrdinalRank(myRankIdx, existingCohort.length + 1)

  // Link the actual student record when we can find them
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

  // Re-sync all ranks across the entire batch/term cohort
  await recomputeBatchRanks(batch, termType || 'Mid-Term', academicYear || '2025-2026', schoolId)

  return NextResponse.json(report, { status: 201 })
}

// PATCH & PUT — edit a progress report (?id=)
export async function PATCH(req: NextRequest) {
  return handleUpdate(req)
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req)
}

async function handleUpdate(req: NextRequest) {
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
  
  // Recompute and sync exact ranking across the cohort
  const targetBatch = updated.batch || existing.batch
  const targetTerm = updated.termType || existing.termType
  const targetYear = updated.academicYear || existing.academicYear
  await recomputeBatchRanks(targetBatch, targetTerm, targetYear, schoolId)

  // Fetch updated row to return correct rank
  const [freshReport] = await db.select().from(progressReports).where(eq(progressReports.id, id))
  const updatedSubjects = await db.select().from(progressReportSubjects).where(eq(progressReportSubjects.progressReportId, id))
  return NextResponse.json({ ...(freshReport || updated), subjects: updatedSubjects })
}

// DELETE — remove a progress report (?id=)
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

  const [existing] = await db.select().from(progressReports).where(and(...conditions))
  await db.delete(progressReports).where(and(...conditions))

  if (existing) {
    await recomputeBatchRanks(existing.batch, existing.termType, existing.academicYear, schoolId)
  }

  return NextResponse.json({ success: true })
}
