import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { specialClasses } from '@/lib/db/schema'
import { isUuid, requireSchool } from '@/lib/tenant'
import { errorResponse, HttpError } from '@/lib/api/http'
import { todayIST, toTeacherSchedule } from '@/lib/legacyPortal'

export const dynamic = 'force-dynamic'

// Teacher "today's schedule" items — moved from the MongoDB TeacherSchedule
// collection to Postgres special_classes (type 'Extra'). Same JSON shape as
// before ({ _id, date, time, activity, batch, location, status }); status is
// derived from the date (there is no status column). Scoped to the session's
// school; teachers only see and change their own items.

async function requireStaff() {
  const session = await auth()
  if (!session) throw new HttpError(401, 'Unauthorized')
  const role = (session.user as any).role
  if (role !== 'management' && role !== 'teacher') throw new HttpError(403, 'Forbidden')
  const schoolId = requireSchool(session)
  const email = ((session.user as any).email || '') as string
  return { session, role: role as 'management' | 'teacher', schoolId, email }
}

function scope(ctx: { role: string; schoolId: string; email: string }) {
  const conditions = [eq(specialClasses.schoolId, ctx.schoolId)]
  if (ctx.role === 'teacher') conditions.push(eq(specialClasses.teacherEmail, ctx.email))
  return conditions
}

function fieldsFrom(body: Record<string, unknown>) {
  const s = (k: string, max: number) => {
    const v = body[k]
    if (v === undefined || v === null) return undefined
    const out = String(v).trim()
    if (out.length > max) throw new HttpError(400, `${k} is too long`)
    return out
  }
  const date = s('date', 10)
  if (date !== undefined && date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD')
  return {
    date: date || undefined,
    time: s('time', 20),
    activity: s('activity', 255),
    batch: s('batch', 255),
    location: s('location', 100),
  }
}

export async function GET(req: Request) {
  try {
    const ctx = await requireStaff()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const conditions = scope(ctx)
    if (date) conditions.push(eq(specialClasses.date, date))

    const rows = await db.select().from(specialClasses).where(and(...conditions))
      .orderBy(asc(specialClasses.date), asc(specialClasses.startTime))
    const today = todayIST()
    return NextResponse.json(rows.map(r => toTeacherSchedule(r, today)), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/teacher-portal/schedule')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireStaff()
    const body = (await req.json()) as Record<string, unknown>
    const f = fieldsFrom(body)
    if (!f.activity || !f.time) return NextResponse.json({ error: 'activity and time are required' }, { status: 400 })
    if (!ctx.email) return NextResponse.json({ error: 'Your account has no email address' }, { status: 400 })

    const [row] = await db.insert(specialClasses).values({
      title: f.activity,
      type: 'Extra',
      teacherName: (ctx.session.user as any).name || '',
      teacherEmail: ctx.email,
      batch: f.batch ?? '',
      date: f.date ?? todayIST(),
      startTime: f.time,
      endTime: f.time,
      room: f.location ?? '',
      schoolId: ctx.schoolId,
    }).returning()
    return NextResponse.json(toTeacherSchedule(row))
  } catch (error) {
    return errorResponse(error, 'POST /api/teacher-portal/schedule')
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const ctx = await requireStaff()
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = await db.delete(specialClasses)
      .where(and(eq(specialClasses.id, id), ...scope(ctx)))
      .returning({ id: specialClasses.id })
    if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/teacher-portal/schedule')
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const ctx = await requireStaff()
    if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const f = fieldsFrom((await req.json()) as Record<string, unknown>)
    const updates: Partial<typeof specialClasses.$inferInsert> = { updatedAt: new Date() }
    if (f.activity) updates.title = f.activity
    if (f.time) { updates.startTime = f.time; updates.endTime = f.time }
    if (f.date) updates.date = f.date
    if (f.batch !== undefined) updates.batch = f.batch
    if (f.location !== undefined) updates.room = f.location

    const [updated] = await db.update(specialClasses).set(updates)
      .where(and(eq(specialClasses.id, id), ...scope(ctx)))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(toTeacherSchedule(updated))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/teacher-portal/schedule')
  }
}
