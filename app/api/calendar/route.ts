import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { calendarEvents } from '@/lib/db/schema'
import { eq, and, asc, gte } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import crypto from 'crypto'

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
    const { title, date, endDate, type, scope, scopeValue, description, recurrencePattern, recurrenceEndDate } = body

    if (!title?.trim() || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const eventsToInsert = []

    if (recurrencePattern && recurrencePattern !== 'none') {
      if (!recurrenceEndDate) {
        return NextResponse.json({ error: 'Missing recurrence end date.' }, { status: 400 })
      }
      const seriesId = crypto.randomUUID()
      let currentStartDate = new Date(date)
      let currentEndDate = endDate ? new Date(endDate) : null
      const untilDate = new Date(recurrenceEndDate)

      // safety cap to prevent infinite loop (max ~365 instances)
      let count = 0
      while (currentStartDate <= untilDate && count < 400) {
        eventsToInsert.push({
          title: title.trim(),
          date: currentStartDate.toISOString().split('T')[0],
          endDate: currentEndDate ? currentEndDate.toISOString().split('T')[0] : null,
          type,
          scope: scope?.trim() || 'School-wide',
          scopeValue: scopeValue?.trim() || '',
          description: description || '',
          schoolId,
          seriesId,
        })

        if (recurrencePattern === 'daily') {
          currentStartDate.setDate(currentStartDate.getDate() + 1)
          if (currentEndDate) currentEndDate.setDate(currentEndDate.getDate() + 1)
        } else if (recurrencePattern === 'weekly') {
          currentStartDate.setDate(currentStartDate.getDate() + 7)
          if (currentEndDate) currentEndDate.setDate(currentEndDate.getDate() + 7)
        } else if (recurrencePattern === 'monthly') {
          currentStartDate.setMonth(currentStartDate.getMonth() + 1)
          if (currentEndDate) currentEndDate.setMonth(currentEndDate.getMonth() + 1)
        }
        count++
      }
    } else {
      eventsToInsert.push({
        title: title.trim(),
        date,
        endDate: endDate || null,
        type,
        scope: scope?.trim() || 'School-wide',
        scopeValue: scopeValue?.trim() || '',
        description: description || '',
        schoolId,
      })
    }

    const insertedEvents = await db.insert(calendarEvents).values(eventsToInsert).returning()
    const event = insertedEvents[0]

    // Notify teachers and admins 24 hours prior
    const notifyTime = getScheduleNotificationTime(date)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `Upcoming Event: ${event.title}`,
        message: `An event of type "${event.type}" (${event.scope}${event.scopeValue ? ` - ${event.scopeValue}` : ''}) is scheduled for ${event.date}${event.endDate ? ` to ${event.endDate}` : ''}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

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
    const { id, title, date, endDate, type, scope, scopeValue, description, updateSeries } = body

    if (!id || !title?.trim() || !date || !type) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const condition = schoolId
      ? and(eq(calendarEvents.id, id), eq(calendarEvents.schoolId, schoolId))
      : eq(calendarEvents.id, id)
      
    const [currentEvent] = await db.select().from(calendarEvents).where(condition)
    if (!currentEvent) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    let updatedEvents = []

    if (updateSeries && currentEvent.seriesId) {
      const seriesCondition = schoolId
        ? and(eq(calendarEvents.seriesId, currentEvent.seriesId), eq(calendarEvents.schoolId, schoolId), gte(calendarEvents.date, currentEvent.date))
        : and(eq(calendarEvents.seriesId, currentEvent.seriesId), gte(calendarEvents.date, currentEvent.date))

      updatedEvents = await db.update(calendarEvents).set({
        title: title.trim(),
        type,
        scope: scope?.trim() || 'School-wide',
        scopeValue: scopeValue?.trim() || '',
        description: description || '',
        updatedAt: new Date(),
      }).where(seriesCondition).returning()
    } else {
      updatedEvents = await db.update(calendarEvents).set({
        title: title.trim(),
        date,
        endDate: endDate || null,
        type,
        scope: scope?.trim() || 'School-wide',
        scopeValue: scopeValue?.trim() || '',
        description: description || '',
        updatedAt: new Date(),
      }).where(condition).returning()
    }

    const event = updatedEvents[0]

    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    // Notify teachers and admins of update 24 hours prior
    const notifyTime = getScheduleNotificationTime(date)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'General',
        title: `Updated Event: ${event.title}`,
        message: `The event details for "${event.title}" have been updated. Scheduled for ${event.date}${event.endDate ? ` to ${event.endDate}` : ''}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
    )

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
    const deleteSeries = searchParams.get('deleteSeries') === 'true'
    
    if (!id) return NextResponse.json({ error: 'Missing event ID.' }, { status: 400 })

    const condition = schoolId
      ? and(eq(calendarEvents.id, id), eq(calendarEvents.schoolId, schoolId))
      : eq(calendarEvents.id, id)
      
    const [currentEvent] = await db.select().from(calendarEvents).where(condition)
    if (!currentEvent) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    let deleted
    if (deleteSeries && currentEvent.seriesId) {
      const seriesCondition = schoolId
        ? and(eq(calendarEvents.seriesId, currentEvent.seriesId), eq(calendarEvents.schoolId, schoolId), gte(calendarEvents.date, currentEvent.date))
        : and(eq(calendarEvents.seriesId, currentEvent.seriesId), gte(calendarEvents.date, currentEvent.date))
      
      const deletedEvents = await db.delete(calendarEvents).where(seriesCondition).returning()
      deleted = deletedEvents[0]
    } else {
      const deletedEvents = await db.delete(calendarEvents).where(condition).returning()
      deleted = deletedEvents[0]
    }
    if (deleted) {
      await notifyRoleInSchool(
        ['teacher', 'management'],
        schoolId,
        {
          category: 'General',
          title: `Cancelled Event: ${deleted.title}`,
          message: `The event scheduled for ${deleted.date} has been cancelled.`,
        },
        (role) => role === 'teacher' ? '/teacher/schedule' : '/management/calendar'
      )
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
