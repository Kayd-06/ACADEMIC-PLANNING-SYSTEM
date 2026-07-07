import { NextRequest, NextResponse } from 'next/server'
import { db, tests } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch scheduled tests (scoped to the session user's school)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const batch = searchParams.get('batch')
    const status = searchParams.get('status')

    const conditions: any[] = []
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (batch && batch !== 'All') conditions.push(eq(tests.batch, batch))
    if (status && status !== 'All') conditions.push(eq(tests.status, status))

    const rows = conditions.length > 0
      ? await db.select().from(tests).where(and(...conditions)).orderBy(asc(tests.date), asc(tests.time))
      : await db.select().from(tests).orderBy(asc(tests.date), asc(tests.time))

    return NextResponse.json(rows)
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

    const body = await req.json()
    const { title, batch, subject, date, time, duration, totalMarks, testType } = body

    if (!title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = (session.user as any).schoolId as string | null

    const [created] = await db.insert(tests).values({
      title: title.trim(),
      batch: batch.trim(),
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      status: 'Upcoming',
      testType: testType || 'Unit Test',
      schoolId,
    }).returning()

    return NextResponse.json(created, { status: 201 })
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

    const body = await req.json()
    const { id, title, batch, subject, date, time, duration, totalMarks, testType, status } = body

    if (!id || !title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const condition = schoolId ? and(eq(tests.id, id), eq(tests.schoolId, schoolId)) : eq(tests.id, id)

    const [updated] = await db.update(tests).set({
      title: title.trim(),
      batch: batch.trim(),
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      testType: testType || 'Unit Test',
      status: status || 'Upcoming',
      updatedAt: new Date(),
    }).where(condition).returning()

    if (!updated) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    return NextResponse.json(updated)
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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing test ID.' }, { status: 400 })

    const schoolId = (session.user as any).schoolId as string | null
    const condition = schoolId ? and(eq(tests.id, id), eq(tests.schoolId, schoolId)) : eq(tests.id, id)

    const [deleted] = await db.delete(tests).where(condition).returning()
    if (!deleted) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
