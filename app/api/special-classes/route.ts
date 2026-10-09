import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { specialClasses, batches, type NewSpecialClass } from '@/lib/db/schema'
import { eq, and, asc, gte, inArray } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import { requireSchool } from '@/lib/tenant'
import { accessibleSchoolIds, resolveRequestedSchool } from '@/lib/tenantAccess'
import { errorResponse } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'

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

// GET — list special classes (?mine=true, ?upcoming=true, ?date=YYYY-MM-DD, ?schoolId=,
// ?batch= (exact batch name), ?programId= (narrows to that program's linked batches))
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    requireSchool(session)

    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === 'true'
    const upcoming = searchParams.get('upcoming') === 'true'
    const date = searchParams.get('date')
    const paramSchoolId = searchParams.get('schoolId')
    const batchFilter = searchParams.get('batch')
    const programIdFilter = searchParams.get('programId')

    // Same visibility rules as /api/schedule: ?schoolId=ALL = schools I
    // administer; ?schoolId=<id> must be one of them; teachers = active
    // school only; NULL-school rows are no longer shown to every tenant.
    let visibleSchoolIds: string[]
    if (role === 'management' && paramSchoolId === 'ALL') {
      visibleSchoolIds = await accessibleSchoolIds(session)
    } else if (role === 'management' && paramSchoolId) {
      visibleSchoolIds = [await resolveRequestedSchool(session, paramSchoolId)]
    } else {
      visibleSchoolIds = [requireSchool(session)]
    }
    const conditions = [inArray(specialClasses.schoolId, visibleSchoolIds)]
    if (mine && session.user.email) {
      conditions.push(eq(specialClasses.teacherEmail, session.user.email.toLowerCase().trim()))
    }
    if (date) conditions.push(eq(specialClasses.date, date))
    if (upcoming) conditions.push(gte(specialClasses.date, new Date().toISOString().split('T')[0]))

    if (batchFilter) {
      conditions.push(eq(specialClasses.batch, batchFilter))
    } else if (programIdFilter) {
      const linked = await db.select({ name: batches.name }).from(batches)
        .where(and(eq(batches.programId, programIdFilter), inArray(batches.schoolId, visibleSchoolIds)))
      const batchNames = linked.map(b => b.name)
      conditions.push(batchNames.length ? inArray(specialClasses.batch, batchNames) : eq(specialClasses.batch, '\0no-match'))
    }

    const rows = await db.select().from(specialClasses).where(and(...conditions))
      .orderBy(asc(specialClasses.date), asc(specialClasses.startTime))

    return NextResponse.json(rows.map(r => ({ _id: r.id, ...r })))
  } catch (error) {
    return errorResponse(error, 'GET /api/special-classes')
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

    const targetSchoolId = role === 'management'
      ? await resolveRequestedSchool(session, body.schoolId)
      : requireSchool(session)

    const [created] = await db.insert(specialClasses).values({
      ...(data as NewSpecialClass),
      schoolId: targetSchoolId,
    }).returning()

    // Notify teachers and admins 24 hours prior
    const notifyTime = getScheduleNotificationTime(created.date, created.startTime)
    runAfterResponse('special-class-created', () => notifyRoleInSchool(
      ['teacher', 'management'],
      targetSchoolId,
      {
        category: 'General',
        title: `Upcoming Special Class: ${created.title}`,
        message: `A special class (${created.type}) for Subject: ${created.subject} (Batch: ${created.batch}) has been scheduled for ${created.date} at ${created.startTime} - ${created.endTime} in Room ${created.room || 'N/A'}.`,
        createdAt: notifyTime,
      },
      (r) => r === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    ))

    return NextResponse.json({ _id: created.id, ...created }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/special-classes')
  }
}

// PATCH — update (?id=) (management, or the owning teacher)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions = [eq(specialClasses.id, id), inArray(specialClasses.schoolId, await accessibleSchoolIds(session))]
    if (role === 'teacher') {
      conditions.push(eq(specialClasses.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
    }

    const body = await req.json()
    const data: Record<string, any> = pickFields(body)
    if (role === 'management' && 'schoolId' in body) {
      data.schoolId = await resolveRequestedSchool(session, body.schoolId)
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
    runAfterResponse('special-class-updated', () => notifyRoleInSchool(
      ['teacher', 'management'],
      updated.schoolId,
      {
        category: 'General',
        title: `Updated Special Class: ${updated.title}`,
        message: `The special class "${updated.title}" details have been updated. Scheduled for ${updated.date} at ${updated.startTime} - ${updated.endTime} in Room ${updated.room || 'N/A'}.`,
        createdAt: notifyTime,
      },
      (r) => r === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    ))

    return NextResponse.json({ _id: updated.id, ...updated })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/special-classes')
  }
}

// DELETE — remove (?id=) (management, or the owning teacher)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const conditions = [eq(specialClasses.id, id), inArray(specialClasses.schoolId, await accessibleSchoolIds(session))]
    if (role === 'teacher') {
      conditions.push(eq(specialClasses.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
    }

    const [deleted] = await db.delete(specialClasses).where(and(...conditions)).returning()
    if (deleted) {
      runAfterResponse('special-class-deleted', () => notifyRoleInSchool(
        ['teacher', 'management'],
        deleted.schoolId,
        {
          category: 'General',
          title: `Cancelled Special Class: ${deleted.title}`,
          message: `The special class "${deleted.title}" scheduled for ${deleted.date} at ${deleted.startTime} has been cancelled.`,
        },
        (r) => r === 'teacher' ? '/teacher/schedule' : '/management/calendar'
      ))
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/special-classes')
  }
}
