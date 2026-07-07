import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { announcements } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Outdated record ID format. Please refresh your browser page (Ctrl+R or F5) to load the latest Postgres data.' }, { status: 400 })
    }

    const data = await req.json()
    
    const [existing] = await db.select().from(announcements).where(eq(announcements.id, id))
    if (!existing) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const updateValues: Record<string, any> = { updatedAt: new Date() }
    if (data.title !== undefined) {
      updateValues.title = data.title
      updateValues.label = data.title
    }
    if (data.content !== undefined) {
      updateValues.content = data.content
      updateValues.sub = data.content.slice(0, 100)
    }
    if (data.type !== undefined) {
      updateValues.type = data.type
      if (data.type === 'Urgent') updateValues.urgent = true
    }
    if (data.scope !== undefined) updateValues.scope = data.scope
    if (data.scopeValue !== undefined) updateValues.scopeValue = data.scopeValue
    if (data.targetRoles !== undefined) updateValues.targetRoles = data.targetRoles
    if (data.attachmentUrl !== undefined) updateValues.attachmentUrl = data.attachmentUrl
    if (data.attachmentName !== undefined) updateValues.attachmentName = data.attachmentName
    if (data.pinned !== undefined) updateValues.pinned = data.pinned
    if (data.authorName !== undefined) updateValues.authorName = data.authorName
    if (data.authorRole !== undefined) updateValues.authorRole = data.authorRole
    if (data.expiryDate !== undefined) updateValues.expiryDate = data.expiryDate
    if (data.done !== undefined) updateValues.done = data.done
    if (data.urgent !== undefined) updateValues.urgent = data.urgent
    if (data.label !== undefined) updateValues.label = data.label
    if (data.sub !== undefined) updateValues.sub = data.sub

    const [updatedRow] = await db.update(announcements)
      .set(updateValues)
      .where(eq(announcements.id, id))
      .returning()

    return NextResponse.json({
      ...updatedRow,
      _id: updatedRow.id,
      label: updatedRow.title || updatedRow.label,
      sub: updatedRow.content || updatedRow.sub,
      urgent: updatedRow.type === 'Urgent' || updatedRow.urgent
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Outdated record ID format. Please refresh your browser page (Ctrl+R or F5) to load the latest Postgres data.' }, { status: 400 })
    }

    await db.delete(announcements).where(eq(announcements.id, id))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
  }
}


