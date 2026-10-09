import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { teacherScheduleItems } from '@/lib/db/schema'
import { isUuid, requireSchool } from '@/lib/tenant'
import { errorResponse, HttpError } from '@/lib/api/http'
import { todayIST, toScheduleItem } from '@/lib/legacyPortal'
import { canManageItem, parseScheduleItem } from '@/lib/teacherSchedule/items'

export const dynamic = 'force-dynamic'

// Teacher "today's schedule" items — the Postgres home of the old Mongo
// TeacherSchedule collection ({ _id, date, time, activity, batch, location,
// status }). Like before, these are standalone items, not classes: they live
// in their own table (teacher_schedule_items, migration 0052), so this route
// can never read, edit or delete a real special class or anything attendance
// is linked to. Scoped to the session's school; a teacher only sees and
// changes their own items, management sees the whole school's.

async function requireStaff() {
  const session = await auth()
  if (!session) throw new HttpError(401, 'Unauthorized')
  const role = (session.user as any).role
  if (role !== 'management' && role !== 'teacher') throw new HttpError(403, 'Forbidden')
  const schoolId = requireSchool(session)
  const email = (((session.user as any).email || '') as string).trim().toLowerCase()
  return { session, role: role as 'management' | 'teacher', schoolId, email }
}

function scope(ctx: { role: string; schoolId: string; email: string }) {
  const conditions = [eq(teacherScheduleItems.schoolId, ctx.schoolId)]
  if (ctx.role === 'teacher') conditions.push(eq(teacherScheduleItems.ownerEmail, ctx.email))
  return conditions
}

/** The item if it exists in the caller's school and the caller may change it. */
async function loadOwnItem(id: string, ctx: Awaited<ReturnType<typeof requireStaff>>) {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(teacherScheduleItems)
    .where(and(eq(teacherScheduleItems.id, id), eq(teacherScheduleItems.schoolId, ctx.schoolId)))
  return row && canManageItem(ctx, row) ? row : null
}

export async function GET(req: Request) {
  try {
    const ctx = await requireStaff()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const conditions = scope(ctx)
    if (date) conditions.push(eq(teacherScheduleItems.date, date))

    const rows = await db.select().from(teacherScheduleItems).where(and(...conditions))
      .orderBy(asc(teacherScheduleItems.date), asc(teacherScheduleItems.time))
    const today = todayIST()
    return NextResponse.json(rows.map(r => toScheduleItem(r, today)), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/teacher-portal/schedule')
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireStaff()
    const parsed = parseScheduleItem((await req.json()) as Record<string, unknown>, false)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    if (!ctx.email) return NextResponse.json({ error: 'Your account has no email address' }, { status: 400 })
    const f = parsed.value

    const [row] = await db.insert(teacherScheduleItems).values({
      schoolId: ctx.schoolId,
      ownerEmail: ctx.email,
      ownerName: (ctx.session.user as any).name || '',
      date: f.date ?? todayIST(),
      time: f.time!,
      activity: f.activity!,
      batch: f.batch ?? '',
      location: f.location ?? '',
      status: f.status ?? null,
    }).returning()
    return NextResponse.json(toScheduleItem(row))
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
    const item = await loadOwnItem(id, ctx)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.delete(teacherScheduleItems)
      .where(and(eq(teacherScheduleItems.id, item.id), eq(teacherScheduleItems.schoolId, ctx.schoolId)))
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
    const parsed = parseScheduleItem((await req.json()) as Record<string, unknown>, true)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const item = await loadOwnItem(id, ctx)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [updated] = await db.update(teacherScheduleItems)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(and(eq(teacherScheduleItems.id, item.id), eq(teacherScheduleItems.schoolId, ctx.schoolId)))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(toScheduleItem(updated))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/teacher-portal/schedule')
  }
}
