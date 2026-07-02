import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { announcements } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Sort pinned first, then by newest date
    const rows = await db.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id,
      label: r.title || r.label || '',
      sub: r.content || r.sub || '',
      urgent: r.type === 'Urgent' || r.urgent
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    const { title, content, type, scope, pinned, authorName, authorRole, expiryDate } = data

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
    }

    const [newRow] = await db.insert(announcements).values({
      title: title.trim(),
      content: content.trim(),
      label: title.trim(),
      sub: content.trim().slice(0, 100),
      type: type || 'General',
      scope: scope || 'All',
      pinned: !!pinned,
      urgent: type === 'Urgent',
      authorName: authorName || session.user.name || 'Admin',
      authorRole: authorRole || 'Admin',
      expiryDate: expiryDate || null,
    }).returning()

    return NextResponse.json({
      ...newRow,
      _id: newRow.id,
      label: newRow.title || newRow.label,
      sub: newRow.content || newRow.sub,
      urgent: newRow.type === 'Urgent' || newRow.urgent
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
  }
}

