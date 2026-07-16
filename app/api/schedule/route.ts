import { NextRequest, NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { db } from '@/lib/db'
import { classSchedules, batches, batchPrograms, type NewClassSchedule } from '@/lib/db/schema'
import { eq, and, asc, inArray, isNull } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'

function getFirstOccurrence(effectiveFromStr: string | null, targetDayOfWeek: number): Date {
  const start = effectiveFromStr ? new Date(effectiveFromStr + 'T00:00:00') : new Date()
  const currentDayOfWeek = start.getDay() // 0 = Sunday, ..., 6 = Saturday
  const diff = (targetDayOfWeek - currentDayOfWeek + 7) % 7
  const occurrence = new Date(start.getTime() + diff * 24 * 60 * 60 * 1000)
  return occurrence
}

function getScheduleNotificationTime(date: Date, timeStr: string): Date {
  const time = timeStr.trim()
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

  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
  return new Date(eventDate.getTime() - 24 * 60 * 60 * 1000)
}

export const dynamic = 'force-dynamic'

const FIELDS = ['teacherName', 'teacherEmail', 'subject', 'batch', 'dayOfWeek', 'startTime', 'endTime', 'room', 'effectiveFrom', 'effectiveTo', 'isActive'] as const

function pickFields(body: any): Partial<NewClassSchedule> {
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  if (data.dayOfWeek !== undefined) data.dayOfWeek = Number(data.dayOfWeek)
  return data
}

// GET — list schedules (?mine=true limits to the signed-in teacher; ?activeOnly=true;
// ?schoolId= (management multi-school override); ?batch= (exact batch name);
// ?programId= (narrows to that program's linked batches, via batch_programs))
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = getSchoolId(session)

    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === 'true'
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const paramSchoolId = searchParams.get('schoolId')
    const batchFilter = searchParams.get('batch')
    const programIdFilter = searchParams.get('programId')

    const conditions = []
    if (role === 'management') {
      if (paramSchoolId !== 'ALL') {
        const targetSchoolId = paramSchoolId ?? schoolId
        // A missing/malformed schoolId must never fall through to "no
        // filter" (that would leak every school's slots) — it means "no
        // school", so only school-less (visible-to-all) slots match.
        conditions.push(
          targetSchoolId && targetSchoolId !== 'null'
            ? eq(classSchedules.schoolId, targetSchoolId)
            : isNull(classSchedules.schoolId)
        )
      }
    } else {
      conditions.push(schoolId ? eq(classSchedules.schoolId, schoolId) : isNull(classSchedules.schoolId))
    }
    if (mine && session.user.email) {
      conditions.push(eq(classSchedules.teacherEmail, session.user.email.toLowerCase().trim()))
    }
    if (activeOnly) conditions.push(eq(classSchedules.isActive, true))

    if (batchFilter) {
      conditions.push(eq(classSchedules.batch, batchFilter))
    } else if (programIdFilter) {
      const linked = await db.select({ name: batches.name }).from(batches)
        .innerJoin(batchPrograms, eq(batchPrograms.batchId, batches.id))
        .where(eq(batchPrograms.programId, programIdFilter))
      const batchNames = linked.map(b => b.name)
      conditions.push(batchNames.length ? inArray(classSchedules.batch, batchNames) : eq(classSchedules.batch, '\0no-match'))
    }

    const rows = conditions.length
      ? await db.select().from(classSchedules).where(and(...conditions)).orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime))
      : await db.select().from(classSchedules).orderBy(asc(classSchedules.dayOfWeek), asc(classSchedules.startTime))

    return NextResponse.json(rows.map(r => ({ _id: r.id, ...r })))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a schedule slot (management, or teacher for themselves)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = getSchoolId(session)

    const body = await req.json()
    const data = pickFields(body)

    // Teachers can only create slots for themselves
    if (role === 'teacher') {
      data.teacherEmail = session.user.email ?? ''
      data.teacherName = session.user.name ?? ''
    }
    if (!data.teacherEmail) data.teacherEmail = session.user.email ?? ''
    if (!data.teacherName) data.teacherName = session.user.name ?? ''

    data.teacherEmail = data.teacherEmail.toLowerCase().trim()

    if (!data.subject || !data.batch || data.dayOfWeek === undefined || isNaN(data.dayOfWeek as number) || !data.startTime || !data.endTime) {
      return NextResponse.json({ error: 'subject, batch, dayOfWeek, startTime and endTime are required' }, { status: 400 })
    }
    if ((data.dayOfWeek as number) < 0 || (data.dayOfWeek as number) > 6) {
      return NextResponse.json({ error: 'dayOfWeek must be 0 (Sunday) through 6 (Saturday)' }, { status: 400 })
    }

    let targetSchoolId = (role === 'management' && body.schoolId !== undefined)
      ? body.schoolId
      : schoolId
    if (targetSchoolId === 'ALL' || targetSchoolId === 'null' || !targetSchoolId) {
      targetSchoolId = null
    }

    const [created] = await db.insert(classSchedules).values({
      ...(data as NewClassSchedule),
      schoolId: targetSchoolId,
    }).returning()

    // Notify teachers and admins 24 hours prior to the first occurrence
    const firstOccur = getFirstOccurrence(created.effectiveFrom, created.dayOfWeek)
    const notifyTime = getScheduleNotificationTime(firstOccur, created.startTime)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `New Class Schedule: ${created.subject}`,
        message: `A recurring class for Subject: ${created.subject} (Batch: ${created.batch}) has been scheduled on ${days[created.dayOfWeek]}s at ${created.startTime} - ${created.endTime} (Teacher: ${created.teacherName}).`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

    return NextResponse.json({ _id: created.id, ...created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a slot (?id=) (management, or the owning teacher)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = getSchoolId(session)

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(classSchedules.id, id)]
    if (role === 'teacher') {
      if (schoolId) conditions.push(eq(classSchedules.schoolId, schoolId))
      conditions.push(eq(classSchedules.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
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

    const [updated] = await db.update(classSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

    // Notify teachers and admins 24 hours prior to the first occurrence
    const firstOccur = getFirstOccurrence(updated.effectiveFrom, updated.dayOfWeek)
    const notifyTime = getScheduleNotificationTime(firstOccur, updated.startTime)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `Updated Class Schedule: ${updated.subject}`,
        message: `Timetable slot updated: Recurring class for Subject: ${updated.subject} (Batch: ${updated.batch}) is scheduled on ${days[updated.dayOfWeek]}s at ${updated.startTime} - ${updated.endTime}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

    return NextResponse.json({ _id: updated.id, ...updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a slot (?id=) (management, or the owning teacher)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    const schoolId = getSchoolId(session)

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(classSchedules.id, id)]
    if (role === 'teacher') {
      if (schoolId) conditions.push(eq(classSchedules.schoolId, schoolId))
      conditions.push(eq(classSchedules.teacherEmail, (session.user.email ?? '').toLowerCase().trim()))
    } else if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [deleted] = await db.delete(classSchedules).where(and(...conditions)).returning()
    if (deleted) {
      await notifyRoleInSchool(
        ['teacher', 'management'],
        schoolId,
        {
          category: 'General',
          title: `Cancelled Class Schedule: ${deleted.subject}`,
          message: `The recurring class schedule for Subject: ${deleted.subject} (Batch: ${deleted.batch}) has been cancelled.`,
        },
        (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
      )
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
