import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudyMaterial from '@/models/StudyMaterial'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    const materials = await StudyMaterial.find().sort({ createdAt: 1 })
    return NextResponse.json(materials, {
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
    // Auto-generate initials if not provided
    if (!body.initials && body.provider) {
      body.initials = body.provider.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    const material = await StudyMaterial.create(body)
    return NextResponse.json(material)
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
    await StudyMaterial.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
