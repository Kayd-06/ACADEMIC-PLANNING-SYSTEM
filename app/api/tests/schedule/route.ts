import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Test from '@/models/Test'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch scheduled tests
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const batch = searchParams.get('batch')
    const status = searchParams.get('status')

    const query: Record<string, any> = {}
    if (batch && batch !== 'All') query.batch = batch
    if (status && status !== 'All') query.status = status

    const tests = await Test.find(query).sort({ date: 1, time: 1 }).lean()
    return NextResponse.json(tests)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — schedule a new test
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { title, batch, subject, date, time, duration, totalMarks, testType } = body

    if (!title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const test = await Test.create({
      title: title.trim(),
      batch: batch.trim(),
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      status: 'Upcoming',
      testType: testType || 'Unit Test'
    })

    return NextResponse.json(test, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — cancel/delete a scheduled test
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing test ID.' }, { status: 400 })
    }

    await Test.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit a scheduled test
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { id, title, batch, subject, date, time, duration, totalMarks, testType, status } = body

    if (!id || !title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const test = await Test.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        batch: batch.trim(),
        subject: subject.trim(),
        date,
        time: time.trim(),
        duration: Number(duration),
        totalMarks: Number(totalMarks),
        testType: testType || 'Unit Test',
        status: status || 'Upcoming'
      },
      { new: true }
    )

    return NextResponse.json(test)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


