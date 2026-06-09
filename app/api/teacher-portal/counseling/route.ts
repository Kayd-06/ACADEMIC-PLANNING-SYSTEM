import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudentCounseling from '@/models/StudentCounseling'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    const counseling = await StudentCounseling.find().sort({ createdAt: -1 })
    return NextResponse.json(counseling, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const entry = await StudentCounseling.create(body)
    return NextResponse.json(entry)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await connectDB()
    await StudentCounseling.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
