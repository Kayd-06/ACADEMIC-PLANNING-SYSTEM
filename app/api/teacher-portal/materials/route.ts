import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudyMaterial from '@/models/StudyMaterial'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

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
    const formData = await req.formData()
    
    const body: any = {
      provider: formData.get('provider'),
      subject: formData.get('subject'),
      type: formData.get('type'),
      count: parseInt(formData.get('count') as string || '1'),
      fileName: formData.get('fileName'),
      fileSize: formData.get('fileSize')
    }

    const file = formData.get('file') as File | null
    if (file && file.name) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      const uploadDir = path.join(process.cwd(), 'public/uploads')
      try {
        await mkdir(uploadDir, { recursive: true })
      } catch (e) {}
      
      const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = path.join(uploadDir, uniqueName)
      await writeFile(filePath, buffer)
      
      body.fileUrl = `/uploads/${uniqueName}`
    }

    if (!body.initials && body.provider) {
      body.initials = body.provider.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const material = await StudyMaterial.create(body)
    return NextResponse.json(material)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const { id, provider, subject, type, count } = body

    if (!id) return NextResponse.json({ error: 'Missing material ID.' }, { status: 400 })

    const updates: any = {}
    if (provider !== undefined) {
      updates.provider = provider
      updates.initials = provider.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (subject !== undefined) updates.subject = subject
    if (type !== undefined) updates.type = type
    if (count !== undefined) updates.count = parseInt(count as string || '1')

    const updated = await StudyMaterial.findByIdAndUpdate(id, updates, { new: true })
    if (!updated) return NextResponse.json({ error: 'Material not found.' }, { status: 404 })

    return NextResponse.json(updated)
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
