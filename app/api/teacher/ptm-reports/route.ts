import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { savePtmReport, listPtmReports } from '@/lib/db/queries/ptm-reports'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId') || undefined
  const batch = searchParams.get('batch') || undefined
  const schoolId = (session.user as any).schoolId ?? null

  try {
    const ptmLogs = await listPtmReports({ studentId, batch, schoolId })
    return NextResponse.json(ptmLogs)
  } catch (error: any) {
    console.error('Error fetching PTM reports:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch PTM reports' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { studentId, batch, date, parentName, parentAttended, discussionNotes, actionItems, followUpDate } = body

    if (!studentId || !date || discussionNotes === undefined) {
      return NextResponse.json({ error: 'Missing required fields: studentId, date, discussionNotes' }, { status: 400 })
    }

    const schoolId = (session.user as any).schoolId ?? null
    const facultyId = session.user.id ?? null

    const report = await savePtmReport({
      studentId,
      batch,
      date,
      parentName,
      parentAttended: parentAttended !== false,
      discussionNotes: discussionNotes || '',
      actionItems: actionItems || '',
      followUpDate,
      facultyId,
      schoolId,
    })

    return NextResponse.json({
      success: true,
      message: 'Parent meeting log recorded successfully.',
      report,
    })
  } catch (error: any) {
    console.error('Error saving PTM report:', error)
    return NextResponse.json({ error: error.message || 'Failed to save PTM report' }, { status: 500 })
  }
}
