import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Protocol from '@/models/Protocol'
import { auth } from '@/lib/auth'

export async function GET() {
  try {
    await connectDB()
    const protocols = await Protocol.find().sort({ updatedAt: -1 })
    return NextResponse.json(protocols)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch protocols' }, { status: 500 })
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
    const protocol = await Protocol.create(data)
    return NextResponse.json(protocol)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create protocol' }, { status: 500 })
  }
}
