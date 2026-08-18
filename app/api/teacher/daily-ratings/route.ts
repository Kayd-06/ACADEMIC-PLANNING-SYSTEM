import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { findStudentsByBatch } from '@/lib/db/queries/students'
import { saveDailyStudentRatings, getDailyRatingsForBatchAndDate } from '@/lib/db/queries/daily-ratings'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const batch = searchParams.get('batch')
  const date = searchParams.get('date')

  if (!batch || !date) {
    return NextResponse.json({ error: 'Missing batch or date parameter' }, { status: 400 })
  }

  try {
    const schoolId = (session.user as any).schoolId ?? null
    const studentList = await findStudentsByBatch(batch, schoolId)
    const existingRatings = await getDailyRatingsForBatchAndDate(batch, date, schoolId)

    const existingMap = new Map(existingRatings.map(r => [r.studentId, r]))

    const rosterWithRatings = studentList.map(s => {
      const existing = existingMap.get(s.id)
      return {
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo,
        batch: s.batch,
        attitude: existing?.attitude || 'Good',
        behaviour: existing?.behaviour || 'Good',
        focus: existing?.focus || 'Good',
        interaction: existing?.interaction || 'Good',
        notes: existing?.notes || '',
        isSaved: Boolean(existing),
      }
    })

    return NextResponse.json({
      batch,
      date,
      students: rosterWithRatings,
    })
  } catch (error: any) {
    console.error('Error fetching daily ratings:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch daily ratings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { batch, date, ratings } = body

    if (!batch || !date || !Array.isArray(ratings)) {
      return NextResponse.json({ error: 'Invalid request body. Expected batch, date, ratings array.' }, { status: 400 })
    }

    const schoolId = (session.user as any).schoolId ?? null
    const facultyId = session.user.id ?? null

    const saved = await saveDailyStudentRatings(batch, date, ratings, facultyId, schoolId)

    return NextResponse.json({
      success: true,
      message: `Successfully saved daily ratings for ${saved.length} students.`,
      saved,
    })
  } catch (error: any) {
    console.error('Error saving daily ratings:', error)
    return NextResponse.json({ error: error.message || 'Failed to save daily ratings' }, { status: 500 })
  }
}
