import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Protocol from '@/models/Protocol'

const DEFAULT_PROTOCOLS = [
  { label: 'Child Safety Policy', sub: 'Reviewed: Oct 2023', status: 'completed', reviewedAt: 'Oct 2023' },
  { label: 'Emergency Response Drill', sub: 'Overdue by 5 days', status: 'overdue', overdueDays: 5 },
  { label: 'Data Privacy Agreement', sub: 'Signed & Active', status: 'completed', reviewedAt: 'Sep 2023' },
]

export async function GET() {
  try {
    await connectDB()
    let protocols = await Protocol.find().sort({ createdAt: 1 })
    if (protocols.length === 0) {
      await Protocol.insertMany(DEFAULT_PROTOCOLS)
      protocols = await Protocol.find().sort({ createdAt: 1 })
    }
    return NextResponse.json(protocols)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const protocol = await Protocol.create(body)
    return NextResponse.json(protocol)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const { id, ...update } = body
    const protocol = await Protocol.findByIdAndUpdate(id, update, { new: true })
    return NextResponse.json(protocol)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    await Protocol.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
