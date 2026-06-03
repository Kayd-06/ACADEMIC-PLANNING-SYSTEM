import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Requirement from '@/models/Requirement'

export async function GET() {
  try {
    await connectDB()
    const requirements = await Requirement.find({}).sort({ createdAt: -1 })
    return NextResponse.json(requirements)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const requirement = await Requirement.create(body)
    return NextResponse.json(requirement)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 })
  }
}
