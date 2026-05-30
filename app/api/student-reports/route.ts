import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StudentReport from '@/models/StudentReport'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    let reports
    if (session.user.role === 'management') {
      // Admins see all reports
      reports = await StudentReport.find({}).sort({ uploadedAt: -1 }).lean()
    } else {
      // Teachers see only their own
      reports = await StudentReport.find({ teacherId: session.user.id }).sort({ uploadedAt: -1 }).lean()
    }

    return NextResponse.json(reports)
  } catch (err) {
    console.error('[student-reports GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can upload reports' }, { status: 403 })
    }

    const body = await req.json()
    const { className, subject, term, students } = body

    if (!className || !subject || !term || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await connectDB()

    const report = await StudentReport.create({
      teacherId: session.user.id,
      teacherName: session.user.name,
      className,
      subject,
      term,
      students,
      uploadedAt: new Date(),
    })

    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    console.error('[student-reports POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
