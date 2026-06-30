import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Announcement from '@/models/Announcement'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    // Sort pinned first, then by newest date
    const announcements = await Announcement.find().sort({ pinned: -1, createdAt: -1 })
    return NextResponse.json(announcements)
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

    await connectDB()
    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      type: type || 'General',
      scope: scope || 'All',
      pinned: !!pinned,
      authorName: authorName || session.user.name || 'Admin',
      authorRole: authorRole || 'Admin',
      expiryDate: expiryDate || undefined
    })

    return NextResponse.json(announcement, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
  }
}
