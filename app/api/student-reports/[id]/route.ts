import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StudentReport from '@/models/StudentReport'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await connectDB()

    const report = await StudentReport.findById(id).lean()
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Teachers can only see their own reports
    if (
      session.user.role === 'teacher' &&
      report.teacherId?.toString() !== session.user.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (err) {
    console.error('[student-reports/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
