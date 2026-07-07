import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['Announcement', 'Result', 'Assignment', 'Fee', 'Attendance', 'General']

// GET — the signed-in user's inbox (?category= filter, ?unreadOnly=true)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id!

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const conditions = [eq(notifications.userId, userId)]
    if (category && CATEGORIES.includes(category)) conditions.push(eq(notifications.category, category))
    if (unreadOnly) conditions.push(eq(notifications.isRead, false))

    const [items, [{ value: unreadCount }]] = await Promise.all([
      db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(100),
      db.select({ value: count() }).from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
    ])

    return NextResponse.json({ items, unreadCount: Number(unreadCount) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — mark read: { id } for one, { all: true } for everything
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id!

    const body = await req.json()
    if (body.all) {
      await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      return NextResponse.json({ success: true })
    }

    if (!body.id) return NextResponse.json({ error: 'id or all:true is required' }, { status: 400 })
    const [updated] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, body.id), eq(notifications.userId, userId)))
      .returning()
    if (!updated) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove one (?id=) or all read ones (?read=true)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id!

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const readOnly = searchParams.get('read') === 'true'

    if (id) {
      await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    } else if (readOnly) {
      await db.delete(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)))
    } else {
      return NextResponse.json({ error: 'id or read=true is required' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
