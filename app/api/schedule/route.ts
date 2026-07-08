import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classSchedules, type NewClassSchedule } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'

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

// GET — list schedules (?mine=true limits to the signed-in teacher; ?activeOnly=true)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const mine = searchParams.get('mine') === 'true'
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const conditions = []
    if (schoolId) conditions.push(eq(classSchedules.schoolId, schoolId))
    if (mine && session.user.email) conditions.push(eq(classSchedules.teacherEmail, session.user.email))
    if (activeOnly) conditions.push(eq(classSchedules.isActive, true))

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
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const data = pickFields(body)

    // Teachers can only create slots for themselves
    if (role === 'teacher') {
      data.teacherEmail = session.user.email ?? ''
      data.teacherName = session.user.name ?? ''
    }
    if (!data.teacherEmail) data.teacherEmail = session.user.email ?? ''
    if (!data.teacherName) data.teacherName = session.user.name ?? ''

    if (!data.subject || !data.batch || data.dayOfWeek === undefined || isNaN(data.dayOfWeek as number) || !data.startTime || !data.endTime) {
      return NextResponse.json({ error: 'subject, batch, dayOfWeek, startTime and endTime are required' }, { status: 400 })
    }
    if ((data.dayOfWeek as number) < 0 || (data.dayOfWeek as number) > 6) {
      return NextResponse.json({ error: 'dayOfWeek must be 0 (Sunday) through 6 (Saturday)' }, { status: 400 })
    }

    const [created] = await db.insert(classSchedules).values({
      ...(data as NewClassSchedule),
      schoolId,
    }).returning()
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
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(classSchedules.id, id)]
    if (schoolId) conditions.push(eq(classSchedules.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(classSchedules.teacherEmail, session.user.email ?? ''))
    else if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const data = pickFields(body)
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const [updated] = await db.update(classSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
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
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const conditions = [eq(classSchedules.id, id)]
    if (schoolId) conditions.push(eq(classSchedules.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(classSchedules.teacherEmail, session.user.email ?? ''))
    else if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await db.delete(classSchedules).where(and(...conditions))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
