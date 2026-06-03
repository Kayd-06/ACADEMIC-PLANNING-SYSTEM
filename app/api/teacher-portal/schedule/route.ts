import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import TeacherSchedule from '@/models/TeacherSchedule'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    await connectDB()
    
    let query = {}
    if (date) query = { date }

    const schedules = await TeacherSchedule.find(query).sort({ date: 1, time: 1 })
    return NextResponse.json(schedules)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body.date) {
      const d = new Date()
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      body.date = d.toISOString().split('T')[0]
    }
    const schedule = await TeacherSchedule.create(body)
    return NextResponse.json(schedule)
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
    await TeacherSchedule.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await req.json()
    await connectDB()
    const updated = await TeacherSchedule.findByIdAndUpdate(id, body, { new: true })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

