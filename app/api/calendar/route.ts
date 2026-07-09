import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const EVENT_TYPES = ['Holiday', 'Exam/Test', 'Event', 'Parent Meeting', 'Meeting', 'Test']
const SCOPES = ['School-wide', 'Program', 'Batch']

function toApiShape(e: any) {
  return { ...e, _id: e.id }
}

// GET — load calendar events (school-scoped; teachers see them read-only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const rows = schoolId
      ? await db.select().from(calendarEvents).where(eq(calendarEvents.schoolId, schoolId)).orderBy(asc(calendarEvents.date))
      : await db.select().from(calendarEvents).orderBy(asc(calendarEvents.date))

    return NextResponse.json(rows.map(toApiShape))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create new calendar event (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { title, date, endDate, type, scope, scopeValue, description } = body

    if (!title?.trim() || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const [event] = await db.insert(calendarEvents).values({
      title: title.trim(),
      date,
      endDate: endDate || null,
      type,
      scope: scope?.trim() || 'School-wide',
      scopeValue: scopeValue?.trim() || '',
      description: description || '',
      schoolId,
    }).returning()

    return NextResponse.json(toApiShape(event), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — update calendar event (management only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { id, title, date, endDate, type, scope, scopeValue, description } = body

    if (!id || !title?.trim() || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const condition = schoolId
      ? and(eq(calendarEvents.id, id), eq(calendarEvents.schoolId, schoolId))
      : eq(calendarEvents.id, id)
    const [event] = await db.update(calendarEvents).set({
      title: title.trim(),
      date,
      endDate: endDate || null,
      type,
      scope: scope?.trim() || 'School-wide',
      scopeValue: scopeValue?.trim() || '',
      description: description || '',
      updatedAt: new Date(),
    }).where(condition).returning()

    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    return NextResponse.json(toApiShape(event))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove calendar event (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing event ID.' }, { status: 400 })

    const condition = schoolId
      ? and(eq(calendarEvents.id, id), eq(calendarEvents.schoolId, schoolId))
      : eq(calendarEvents.id, id)
    await db.delete(calendarEvents).where(condition)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
