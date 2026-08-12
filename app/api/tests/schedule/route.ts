import { NextRequest, NextResponse } from 'next/server'
import { db, tests, users } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

function getScheduleNotificationTime(dateStr: string, timeStr?: string | null): Date {
  const time = timeStr ? timeStr.trim() : '00:00'
  let hours = 0
  let minutes = 0

  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (match) {
    hours = Number(match[1])
    minutes = Number(match[2])
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
  } else {
    const parts = time.split(':').map(Number)
    hours = parts[0] || 0
    minutes = parts[1] || 0
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const eventDate = new Date(year, month - 1, day, hours, minutes)
  return new Date(eventDate.getTime() - 24 * 60 * 60 * 1000)
}

export const dynamic = 'force-dynamic'

// GET — fetch scheduled tests. Teachers see only their own; management sees
// every test in the school (including legacy rows with no owner) plus each
// row's faculty name.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)
    const { searchParams } = new URL(req.url)
    const batch = searchParams.get('batch')
    const status = searchParams.get('status')
    const program = searchParams.get('program')
    const teacherId = searchParams.get('teacherId')

    const conditions: any[] = []
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (batch && batch !== 'All') conditions.push(eq(tests.batch, batch))
    if (status && status !== 'All') conditions.push(eq(tests.status, status))
    if (program && program !== 'All') conditions.push(eq(tests.program, program))
    if (role === 'teacher') {
      conditions.push(eq(tests.createdByUserId, userId))
    } else if (teacherId && teacherId !== 'All') {
      conditions.push(eq(tests.createdByUserId, teacherId))
    }

    const baseQuery = db
      .select({
        id: tests.id,
        title: tests.title,
        batch: tests.batch,
        program: tests.program,
        subject: tests.subject,
        date: tests.date,
        time: tests.time,
        duration: tests.duration,
        totalMarks: tests.totalMarks,
        status: tests.status,
        testType: tests.testType,
        averageScore: tests.averageScore,
        createdByUserId: tests.createdByUserId,
        paperUrl: tests.paperUrl,
        paperFileName: tests.paperFileName,
        schoolId: tests.schoolId,
        createdAt: tests.createdAt,
        facultyName: users.name,
      })
      .from(tests)
      .leftJoin(users, eq(tests.createdByUserId, users.id))

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(asc(tests.date), asc(tests.time))
      : await baseQuery.orderBy(asc(tests.date), asc(tests.time))

    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — schedule a new test, owned by the creating user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, batch, program, subject, date, time, duration, totalMarks, testType } = body

    if (!title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string

    const [created] = await db.insert(tests).values({
      title: title.trim(),
      batch: batch.trim(),
      program: program?.trim() || '',
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      status: 'Upcoming',
      testType: testType || 'Unit Test',
      createdByUserId: userId,
      schoolId,
    }).returning()

    const notifyTime = getScheduleNotificationTime(created.date, created.time)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `New Test Scheduled: ${created.title}`,
        message: `A test for Subject: ${created.subject} (Batch: ${created.batch}) has been scheduled on ${created.date} at ${created.time}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit a scheduled test. Teachers may only edit their own.
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, title, batch, program, subject, date, time, duration, totalMarks, testType, status } = body

    if (!id || !title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(tests.id, id)]
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(tests.createdByUserId, userId))

    const [updated] = await db.update(tests).set({
      title: title.trim(),
      batch: batch.trim(),
      program: program?.trim() || '',
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      testType: testType || 'Unit Test',
      status: status || 'Upcoming',
      updatedAt: new Date(),
    }).where(and(...conditions)).returning()

    if (!updated) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const notifyTime = getScheduleNotificationTime(updated.date, updated.time)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `Test Schedule Updated: ${updated.title}`,
        message: `The test details have been updated. Scheduled on ${updated.date} at ${updated.time} (${updated.subject} - ${updated.batch}).`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — cancel/delete a scheduled test. Teachers may only delete their own.
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

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(tests.id, id)]
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(tests.createdByUserId, userId))

    const [deleted] = await db.delete(tests).where(and(...conditions)).returning()
    if (!deleted) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `Test Cancelled: ${deleted.title}`,
        message: `The scheduled test for Subject: ${deleted.subject} (Batch: ${deleted.batch}) on ${deleted.date} has been cancelled.`,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
