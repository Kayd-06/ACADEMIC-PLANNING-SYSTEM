import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Protocol from '@/models/Protocol'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    await connectDB()
    const protocol = await Protocol.findByIdAndUpdate(params.id, { ...data, updatedAt: new Date() }, { new: true })
    return NextResponse.json(protocol)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update protocol' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    await Protocol.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete protocol' }, { status: 500 })
  }
}
