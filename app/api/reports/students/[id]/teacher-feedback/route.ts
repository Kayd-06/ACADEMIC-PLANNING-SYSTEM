import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getStudentDailyRatingsSummary } from '@/lib/db/queries/daily-ratings'
import { getStudentPtmSummary } from '@/lib/db/queries/ptm-reports'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: studentId } = await params

  try {
    const schoolId = (session.user as any).schoolId ?? null
    const conditions = [eq(students.id, studentId)]
    if (schoolId) conditions.push(eq(students.schoolId, schoolId))

    const studentRows = await db.select().from(students).where(and(...conditions)).limit(1)

    if (studentRows.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const student = studentRows[0]
    const ratingsSummary = await getStudentDailyRatingsSummary(studentId, schoolId)
    const ptmSummary = await getStudentPtmSummary(studentId, schoolId)

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        batch: student.batch,
        class: student.class,
        section: student.section,
        guardianName: student.parentContact || 'N/A',
        guardianPhone: student.phone || student.parentContact || 'N/A',
      },
      dailyRatings: ratingsSummary,
      ptmReports: ptmSummary,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error fetching teacher feedback summary:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch report' }, { status: 500 })
  }
}
