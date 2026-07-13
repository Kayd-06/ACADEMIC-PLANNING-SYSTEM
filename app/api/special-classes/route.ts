import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { specialClasses, type NewSpecialClass } from '@/lib/db/schema'
import { eq, and, asc, gte } from 'drizzle-orm'
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

const TYPES = ['Extra', 'Doubt', 'Revision', 'Makeup', 'Orientation']
const FIELDS = ['title', 'type', 'teacherName', 'teacherEmail', 'subject', 'batch', 'date', 'startTime', 'endTime', 'room', 'notes'] as const

function pickFields(body: any): Partial<NewSpecialClass> {
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

// GET — list special classes (?mine=true, ?upcoming=true, ?date=YYYY-MM-DD, ?schoolId=)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === 'true'
    const upcoming = searchParams.get('upcoming') === 'true'
    const date = searchParams.get('date')
    const paramSchoolId = searchParams.get('schoolId')

    const conditions = []
    if (role === 'management') {
      const targetSchoolId = paramSchoolId !== null ? paramSchoolId : schoolId
      if (targetSchoolId && targetSchoolId !== 'ALL' && targetSchoolId !== 'null') {
        conditions.push(eq(specialClasses.schoolId, targetSchoolId))
      }
    } else if (schoolId && schoolId !== 'null') {
      conditions.push(eq(specialClasses.schoolId, schoolId))
    }
    if (mine && session.user.email) {
      conditions.push(eq(specialClasses.teacherEmail, session.user.email.toLowerCase().trim()))
    }
    if (date) conditions.push(eq(specialClasses.date, date))
    if (upcoming) conditions.push(gte(specialClasses.date, new Date().toISOString().split('T')[0]))

    const rows = conditions.length
      ? await db.select().from(specialClasses).where(and(...conditions)).orderBy(asc(specialClasses.date), asc(specialClasses.startTime))
      : await db.select().from(specialClasses).orderBy(asc(specialClasses.date), asc(specialClasses.startTime))

    return NextResponse.json(rows.map(r => ({ _id: r.id, ...r })))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a one-off session (management, or teacher for themselves)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const data = pickFields(body)

    if (role === 'teacher') {
      data.teacherEmail = session.user.email ?? ''
      data.teacherName = session.user.name ?? ''
    }
    if (!data.teacherEmail) data.teacherEmail = session.user.email ?? ''
    if (!data.teacherName) data.teacherName = session.user.name ?? ''

    data.teacherEmail = data.teacherEmail.toLowerCase().trim()

    if (!data.title || !data.date || !data.startTime || !data.endTime) {
      return NextResponse.json({ error: 'title, date, startTime and endTime are required' }, { status: 400 })
    }
    if (data.type && !TYPES.includes(data.type)) {
      return NextResponse.json({ error: `Type must be one of: ${TYPES.join(', ')}` }, { status: 400 })
    }

    let targetSchoolId = (role === 'management' && body.schoolId !== undefined)
      ? body.schoolId
      : schoolId
    if (targetSchoolId === 'ALL' || targetSchoolId === 'null' || !targetSchoolId) {
      targetSchoolId = null
    }

    const [created] = await db.insert(specialClasses).values({
      ...(data as NewSpecialClass),
      schoolId: targetSchoolId,
    }).returning()

    // Notify teachers and admins 24 hours prior
    const notifyTime = getScheduleNotificationTime(created.date, created.startTime)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `Upcoming Special Class: ${created.title}`,
        message: `A special class (${created.type}) for Subject: ${created.subject} (Batch: ${created.batch}) has been scheduled for ${created.date} at ${created.startTime} - ${created.endTime} in Room ${created.room || 'N/A'}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

    return NextResponse.json({ _id: created.id, ...created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update (?id=) (management, or the owning teacher)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(specialClasses.id, id)]
    if (role === 'teacher') {
      if (schoolId && schoolId !== 'null') conditions.push(eq(specialClasses.schoolId, schoolId))
      conditions.push(eq(specialClasses.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
    } else if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data: Record<string, any> = pickFields(body)
    if (role === 'management' && 'schoolId' in body) {
      const s = body.schoolId
      data.schoolId = (s && s !== 'ALL' && s !== 'null') ? s : null
    }
    if (data.teacherEmail) data.teacherEmail = data.teacherEmail.toLowerCase().trim()
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    if (data.type && !TYPES.includes(data.type)) {
      return NextResponse.json({ error: `Type must be one of: ${TYPES.join(', ')}` }, { status: 400 })
    }

    const [updated] = await db.update(specialClasses)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Special class not found' }, { status: 404 })

    // Notify teachers and admins of update 24 hours prior
    const notifyTime = getScheduleNotificationTime(updated.date, updated.startTime)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `Updated Special Class: ${updated.title}`,
        message: `The special class "${updated.title}" details have been updated. Scheduled for ${updated.date} at ${updated.startTime} - ${updated.endTime} in Room ${updated.room || 'N/A'}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

    return NextResponse.json({ _id: updated.id, ...updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove (?id=) (management, or the owning teacher)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(specialClasses.id, id)]
    if (role === 'teacher') {
      if (schoolId && schoolId !== 'null') conditions.push(eq(specialClasses.schoolId, schoolId))
      conditions.push(eq(specialClasses.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
    } else if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [deleted] = await db.delete(specialClasses).where(and(...conditions)).returning()
    if (deleted) {
      await notifyRoleInSchool(
        ['teacher', 'management'],
        schoolId,
        {
          category: 'General',
          title: `Cancelled Special Class: ${deleted.title}`,
          message: `The special class "${deleted.title}" scheduled for ${deleted.date} at ${deleted.startTime} has been cancelled.`,
        },
        (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
      )
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
