import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudentCounseling from '@/models/StudentCounseling'

export async function GET() {
  try {
    await connectDB()
    const counseling = await StudentCounseling.find().sort({ createdAt: -1 })
    return NextResponse.json(counseling)
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
