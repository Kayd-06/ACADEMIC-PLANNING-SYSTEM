import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Announcement from '@/models/Announcement'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    await connectDB()
    const announcement = await Announcement.findByIdAndUpdate(params.id, { ...data, updatedAt: new Date() }, { new: true })
    return NextResponse.json(announcement)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    await Announcement.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
