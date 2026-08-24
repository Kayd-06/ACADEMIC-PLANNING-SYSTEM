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
    const { title, date, time, type, attendees, agendaItems } = body

    if (!title || !date || !time) {
      return NextResponse.json({ error: 'Title, date, and time are required' }, { status: 400 })
    }

    const [newMeeting] = await db.insert(meetings).values({
      title,
      date,
      time,
      type: type || 'General',
      attendees: attendees || '',
      schoolId
    }).returning()

    if (agendaItems && Array.isArray(agendaItems) && agendaItems.length > 0) {
      const itemsToInsert = agendaItems.map((item: any) => ({
        meetingId: newMeeting.id,
        itemTitle: item.itemTitle,
        description: item.description || '',
        status: item.status || 'Not Started',
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
      const { status } = body
      if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 })
      const [updated] = await db.update(meetingAgendaItems).set({ status, updatedAt: new Date() }).where(eq(meetingAgendaItems.id, agendaItemId)).returning()
      return NextResponse.json(updated)
    }

    if (meetingId) {
      const { title, date, time, type, attendees } = body
      const [updated] = await db.update(meetings).set({ title, date, time, type, attendees, updatedAt: new Date() }).where(eq(meetings.id, meetingId)).returning()
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
