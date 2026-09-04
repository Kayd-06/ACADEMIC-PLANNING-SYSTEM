import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { meetingAgendaItems } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { meetingId, itemTitle, description, discussion, action, responsibility, targetDate, communicatedTo, communicatedBy, status, priority } = body

    if (!meetingId || !itemTitle) {
      return NextResponse.json({ error: 'Meeting ID and Item Title are required' }, { status: 400 })
    }

    const requiredFields = { discussion, responsibility, targetDate, communicatedTo, communicatedBy }
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    const [newItem] = await db.insert(meetingAgendaItems).values({
      meetingId,
      itemTitle,
      description: description || '',
      discussion,
      action: action || '',
      responsibility,
      targetDate,
      communicatedTo,
      communicatedBy,
      status: status || 'Not Started',
      priority: priority || 'Medium',
      schoolId
    }).returning()

    return NextResponse.json(newItem, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
