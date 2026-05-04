import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Announcement from '@/models/Announcement'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    await connectDB()
    const announcements = await Announcement.find().sort({ updatedAt: -1 })
    return NextResponse.json(announcements)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    await connectDB()
    const announcement = await Announcement.create(data)
    return NextResponse.json(announcement)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
  }
}
