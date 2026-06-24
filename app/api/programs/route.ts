import { NextResponse } from 'next/server'
import Program from '@/models/Program'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }
  await mongoose.connect(process.env.MONGODB_URI)
}

export async function GET(request: Request) {
  try {
    await connectDB()

    const count = await Program.countDocuments()
    if (count === 0) {
      await Program.insertMany([
        {
          title: 'JEE 2-Year Integrated',
          target: 'JEE ADVANCED 2026',
          batches: 4,
          students: 180,
          subjects: 3,
          colorTheme: 'blue'
        },
        {
          title: 'NEET One-Year Crash',
          target: 'NEET 2025',
          batches: 2,
          students: 95,
          subjects: 4,
          colorTheme: 'green'
        },
        {
          title: 'Foundational (Grade 8-10)',
          target: 'BOARD EXAMS',
          batches: 6,
          students: 240,
          subjects: 5,
          colorTheme: 'purple'
        }
      ])
    }

    const programs = await Program.find().sort({ createdAt: 1 })

    return NextResponse.json(programs, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const newProgram = await Program.create(body)
    return NextResponse.json(newProgram)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await Program.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
