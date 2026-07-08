import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents } from '@/lib/db/schema'
import { eq, and, asc, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const EVENT_TYPES = ['Holiday', 'Exam/Test', 'Event', 'Parent Meeting', 'Meeting', 'Test']
const SCOPES = ['School-wide', 'Program', 'Batch']

const currentYearVal = new Date().getFullYear()

// One-time seed when the table is completely empty
const MOCK_EVENTS = [
  { title: 'Summer Vacation', date: `${currentYearVal}-06-01`, endDate: `${currentYearVal}-06-10`, type: 'Holiday', scope: 'School-wide', description: 'Summer break. School reopens on June 11th.' },
  { title: 'Mid-Term Exams', date: `${currentYearVal}-06-15`, endDate: `${currentYearVal}-06-18`, type: 'Exam/Test', scope: 'Batch', scopeValue: 'Grade 11 & 12', description: 'First semester mid-term examinations.' },
  { title: 'Annual Sports Day', date: `${currentYearVal}-06-21`, type: 'Event', scope: 'School-wide', description: 'Annual track & field sports meet.' },
  { title: 'Parent-Teacher Meeting', date: `${currentYearVal}-06-24`, type: 'Parent Meeting', scope: 'Batch', scopeValue: 'Grade 11', description: 'PTM to discuss academic planning and midterm performance.' },
  { title: 'Dussehra Holiday', date: `${currentYearVal}-10-12`, type: 'Holiday', scope: 'School-wide', description: 'Holiday observed for Dussehra festival celebrations.' },
  { title: 'Diwali Break', date: `${currentYearVal}-11-10`, endDate: `${currentYearVal}-11-14`, type: 'Holiday', scope: 'School-wide', description: 'Diwali festival holidays.' },
  { title: 'Winter Holidays', date: `${currentYearVal}-12-24`, endDate: `${currentYearVal + 1}-01-01`, type: 'Holiday', scope: 'School-wide', description: 'Winter break vacation.' },
]

function toApiShape(e: any) {
  return { ...e, _id: e.id }
}

// GET — load calendar events (school-scoped; teachers see them read-only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const [{ value: total }] = await db.select({ value: count() }).from(calendarEvents)
    if (Number(total) === 0) {
      await db.insert(calendarEvents).values(MOCK_EVENTS.map(e => ({ ...e, schoolId })))
    }

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
