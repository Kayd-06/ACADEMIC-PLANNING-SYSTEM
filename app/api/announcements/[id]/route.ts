import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Announcement from '@/models/Announcement'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await req.json()
    
    await connectDB()
    const announcement = await Announcement.findById(id)
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    // Update fields
    if (data.title !== undefined) announcement.title = data.title
    if (data.content !== undefined) announcement.content = data.content
    if (data.type !== undefined) announcement.type = data.type
    if (data.scope !== undefined) announcement.scope = data.scope
    if (data.pinned !== undefined) announcement.pinned = data.pinned
    if (data.authorName !== undefined) announcement.authorName = data.authorName
    if (data.authorRole !== undefined) announcement.authorRole = data.authorRole
    if (data.expiryDate !== undefined) announcement.expiryDate = data.expiryDate
    if (data.done !== undefined) announcement.done = data.done

    announcement.updatedAt = new Date()
    await announcement.save()

    return NextResponse.json(announcement)
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
    await connectDB()
    await Announcement.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete announcement' }, { status: 500 })
  }
}
