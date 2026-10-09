import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { meetings, meetingAgendaItems } from '@/lib/db/schema'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

// Agenda items are scoped through their parent meeting (older agenda rows may
// have a null school_id of their own).
function agendaItemInSchool(agendaItemId: string, schoolId: string) {
  return and(
    eq(meetingAgendaItems.id, agendaItemId),
    inArray(
      meetingAgendaItems.meetingId,
      db.select({ id: meetings.id }).from(meetings).where(eq(meetings.schoolId, schoolId)),
    ),
  )
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = requireSchool(session)

    const meetingsList = await db.select().from(meetings)
      .where(eq(meetings.schoolId, schoolId))
      .orderBy(desc(meetings.createdAt))

    // One query for every meeting's agenda instead of one query per meeting.
    const ids = meetingsList.map(m => m.id)
    const items = ids.length
      ? await db.select().from(meetingAgendaItems)
          .where(inArray(meetingAgendaItems.meetingId, ids))
          .orderBy(asc(meetingAgendaItems.createdAt))
      : []
    const byMeeting = new Map<string, typeof items>()
    for (const item of items) {
      const list = byMeeting.get(item.meetingId) ?? []
      list.push(item)
      byMeeting.set(item.meetingId, list)
    }

    return NextResponse.json(meetingsList.map(m => ({ ...m, agendaItems: byMeeting.get(m.id) ?? [] })))
  } catch (error) {
    return errorResponse(error, 'GET /api/meetings')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate, agendaItems } = body

    if (!title || !date || !time) {
      return NextResponse.json({ error: 'Title, date, and time are required' }, { status: 400 })
    }
    const schoolId = requireSchool(session)

    const meetingId = crypto.randomUUID()
    const insertMeeting = db.insert(meetings).values({
      id: meetingId,
      title,
      date,
      time,
      type: type || 'General',
      venue: venue || '',
      attendees: attendees || '',
      minutesPreparedBy: minutesPreparedBy || '',
      nextMeetingDate: nextMeetingDate || '',
      schoolId,
    }).returning()

    const itemsToInsert = Array.isArray(agendaItems)
      ? agendaItems.map((item: any) => ({
          meetingId,
          itemTitle: item.itemTitle,
          description: item.description || '',
          discussion: item.discussion || '',
          action: item.action || '',
          responsibility: item.responsibility || '',
          targetDate: item.targetDate || '',
          communicatedTo: item.communicatedTo || '',
          communicatedBy: item.communicatedBy || '',
          status: item.status || 'Not Started',
          priority: item.priority || 'Medium',
          schoolId,
        }))
      : []

    // Meeting + agenda are written in one transaction: no meeting without its agenda.
    let newMeeting: typeof meetings.$inferSelect
    let createdAgendaItems: Array<typeof meetingAgendaItems.$inferSelect> = []
    if (itemsToInsert.length > 0) {
      const [m, items] = await db.batch([insertMeeting, db.insert(meetingAgendaItems).values(itemsToInsert).returning()])
      newMeeting = m[0]
      createdAgendaItems = items
    } else {
      const [m] = await db.batch([insertMeeting])
      newMeeting = m[0]
    }

    return NextResponse.json({ ...newMeeting, agendaItems: createdAgendaItems }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/meetings')
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const agendaItemId = searchParams.get('agendaItemId')
    const meetingId = searchParams.get('id')

    const body = await req.json()

    if (agendaItemId) {
      const { status, itemTitle, description, discussion, action, responsibility, targetDate, communicatedTo, communicatedBy, priority } = body

      const requiredFields = { discussion, responsibility, targetDate, communicatedTo, communicatedBy }
      for (const [field, value] of Object.entries(requiredFields)) {
        if (value !== undefined && !value) {
          return NextResponse.json({ error: `${field} is required` }, { status: 400 })
        }
      }
      const schoolId = requireSchool(session)

      const updates: Partial<typeof meetingAgendaItems.$inferInsert> = { updatedAt: new Date() }
      if (status !== undefined) updates.status = status
      if (itemTitle !== undefined) updates.itemTitle = itemTitle
      if (description !== undefined) updates.description = description
      if (discussion !== undefined) updates.discussion = discussion
      if (action !== undefined) updates.action = action
      if (responsibility !== undefined) updates.responsibility = responsibility
      if (targetDate !== undefined) updates.targetDate = targetDate
      if (communicatedTo !== undefined) updates.communicatedTo = communicatedTo
      if (communicatedBy !== undefined) updates.communicatedBy = communicatedBy
      if (priority !== undefined) updates.priority = priority

      const [updated] = await db.update(meetingAgendaItems).set(updates)
        .where(agendaItemInSchool(agendaItemId, schoolId))
        .returning()
      if (!updated) return NextResponse.json({ error: 'Agenda item not found' }, { status: 404 })
      return NextResponse.json(updated)
    }

    if (meetingId) {
      const schoolId = requireSchool(session)
      const { title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate } = body
      const [updated] = await db.update(meetings)
        .set({ title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate, updatedAt: new Date() })
        .where(and(eq(meetings.id, meetingId), eq(meetings.schoolId, schoolId)))
        .returning()
      if (!updated) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/meetings')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const agendaItemId = searchParams.get('agendaItemId')

    if (agendaItemId) {
      const schoolId = requireSchool(session)
      const deleted = await db.delete(meetingAgendaItems)
        .where(agendaItemInSchool(agendaItemId, schoolId))
        .returning({ id: meetingAgendaItems.id })
      if (deleted.length === 0) return NextResponse.json({ error: 'Agenda item not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    if (id) {
      const schoolId = requireSchool(session)
      const deleted = await db.delete(meetings)
        .where(and(eq(meetings.id, id), eq(meetings.schoolId, schoolId)))
        .returning({ id: meetings.id })
      if (deleted.length === 0) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/meetings')
  }
}
