import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { meetings, meetingAgendaItems } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const schoolId = (session.user as any).schoolId as string | null

    let query = db.select().from(meetings).orderBy(desc(meetings.createdAt))
    if (schoolId) {
      query = db.select().from(meetings).where(eq(meetings.schoolId, schoolId)).orderBy(desc(meetings.createdAt)) as any
    }

    const meetingsList = await query
    
    // Fetch agenda items for all meetings
    const allMeetingsWithAgenda = await Promise.all(meetingsList.map(async (m) => {
      const items = await db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, m.id)).orderBy(meetingAgendaItems.createdAt)
      return { ...m, agendaItems: items }
    }))

    return NextResponse.json(allMeetingsWithAgenda)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate, agendaItems } = body

    if (!title || !date || !time) {
      return NextResponse.json({ error: 'Title, date, and time are required' }, { status: 400 })
    }

    const [newMeeting] = await db.insert(meetings).values({
      title,
      date,
      time,
      type: type || 'General',
      venue: venue || '',
      attendees: attendees || '',
      minutesPreparedBy: minutesPreparedBy || '',
      nextMeetingDate: nextMeetingDate || '',
      schoolId
    }).returning()

    if (agendaItems && Array.isArray(agendaItems) && agendaItems.length > 0) {
      const itemsToInsert = agendaItems.map((item: any) => ({
        meetingId: newMeeting.id,
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
        schoolId
      }))
      await db.insert(meetingAgendaItems).values(itemsToInsert)
    }

    // Return the created meeting with its agenda items
    const createdAgendaItems = await db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, newMeeting.id)).orderBy(meetingAgendaItems.createdAt)

    return NextResponse.json({ ...newMeeting, agendaItems: createdAgendaItems }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

      const updates: any = { updatedAt: new Date() }
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

      const [updated] = await db.update(meetingAgendaItems).set(updates).where(eq(meetingAgendaItems.id, agendaItemId)).returning()
      return NextResponse.json(updated)
    }

    if (meetingId) {
      const { title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate } = body
      const [updated] = await db.update(meetings).set({ title, date, time, type, venue, attendees, minutesPreparedBy, nextMeetingDate, updatedAt: new Date() }).where(eq(meetings.id, meetingId)).returning()
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
      await db.delete(meetingAgendaItems).where(eq(meetingAgendaItems.id, agendaItemId))
      return NextResponse.json({ success: true })
    }

    if (id) {
      await db.delete(meetings).where(eq(meetings.id, id))
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
