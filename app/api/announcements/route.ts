import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Announcement from '@/models/Announcement'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function seedAnnouncements() {
  const count = await Announcement.countDocuments({ title: { $exists: true } })
  if (count > 0) return

  // Clear older, simple announcements to avoid type errors
  await Announcement.deleteMany({})

  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const initialAnnouncements = [
    {
      title: 'Emergency Campus Closure Tomorrow',
      content: 'Due to severe weather warnings issued by the meteorological department, the campus will remain closed tomorrow, Tuesday. All offline classes are suspended. Online classes will proceed as per schedule. Stay safe.',
      type: 'Urgent',
      scope: 'All Staff & Students',
      pinned: true,
      urgent: true,
      authorName: 'Sarah Jenkins',
      authorRole: 'Principal',
      createdAt: oneHourAgo,
      updatedAt: oneHourAgo
    },
    {
      title: 'Thanksgiving Break Schedule',
      content: 'Please note that the school will be closed from Wednesday, Nov 22nd to Friday, Nov 24th for the Thanksgiving holiday. Hostels will remain open for international students. Have a wonderful break!',
      type: 'Holiday',
      scope: 'All',
      pinned: false,
      urgent: false,
      authorName: 'David Chen',
      authorRole: 'Admin',
      createdAt: new Date('2026-11-15'),
      updatedAt: new Date('2026-11-15'),
      expiryDate: '2026-11-25'
    }
  ]

  for (const ann of initialAnnouncements) {
    await Announcement.create(ann)
  }
}

export async function GET() {
  try {
    await connectDB()
    await seedAnnouncements()
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
