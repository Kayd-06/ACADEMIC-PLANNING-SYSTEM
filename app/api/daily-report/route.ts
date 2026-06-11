import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import DailyReport from '@/models/DailyReport'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch reports (admin gets all; teacher gets own)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const teacherEmail = searchParams.get('teacherEmail')

    const query: Record<string, any> = {}

    // If the user is a teacher, scope to their own reports
    if ((session.user as any).role === 'teacher') {
      query.teacherEmail = session.user.email
    } else {
      // Admin can filter by teacher email if provided
      if (teacherEmail) query.teacherEmail = teacherEmail
    }

    if (date) query.date = date

    const reports = await DailyReport.find(query).sort({ date: -1, createdAt: -1 })
    return NextResponse.json(reports)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — teacher submits or saves a draft report (upsert by teacher+date)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const body = await req.json()
    const { date, classesHeld, activitiesConducted, materialsUsed, studentsAttended, remarks, status } = body

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })

    const report = await DailyReport.findOneAndUpdate(
      { teacherEmail: session.user.email, date },
      {
        teacherName: session.user.name,
        teacherEmail: session.user.email,
        date,
        classesHeld: classesHeld || [],
        activitiesConducted: activitiesConducted || '',
        materialsUsed: materialsUsed || '',
        studentsAttended: studentsAttended || '',
        remarks: remarks || '',
        status: status || 'draft',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json(report)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a specific report field (e.g. status toggle)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })

    const body = await req.json()
    const report = await DailyReport.findByIdAndUpdate(id, body, { new: true })
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    return NextResponse.json(report)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
