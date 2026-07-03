import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { studyMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const list = schoolId
    ? await db.select().from(studyMaterials).where(eq(studyMaterials.schoolId, schoolId)).orderBy(studyMaterials.createdAt)
    : await db.select().from(studyMaterials).orderBy(studyMaterials.createdAt)

  return NextResponse.json(list, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const formData = await req.formData()
    const provider = (formData.get('provider') as string) || ''
    const subject = (formData.get('subject') as string) || ''
    const type = (formData.get('type') as string) || 'PDF'
    const fileName = (formData.get('fileName') as string) || ''

    let fileUrl: string | null = null
    const file = formData.get('file') as File | null
    if (file && file.name) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const uploadDir = path.join(process.cwd(), 'public/uploads')
      await mkdir(uploadDir, { recursive: true })
      const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      await writeFile(path.join(uploadDir, uniqueName), buffer)
      fileUrl = `/uploads/${uniqueName}`
    }

    const [created] = await db.insert(studyMaterials).values({
      fileName: fileName || file?.name || provider,
      type, fileUrl, subject, provider,
      schoolId,
    }).returning()

    return NextResponse.json(created)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { id, provider, subject, type } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: any = {}
    if (provider !== undefined) updates.provider = provider
    if (subject !== undefined) updates.subject = subject
    if (type !== undefined) updates.type = type

    const condition = schoolId ? and(eq(studyMaterials.id, id), eq(studyMaterials.schoolId, schoolId)) : eq(studyMaterials.id, id)
    const [updated] = await db.update(studyMaterials).set(updates).where(condition).returning()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const condition = schoolId ? and(eq(studyMaterials.id, id), eq(studyMaterials.schoolId, schoolId)) : eq(studyMaterials.id, id)
    await db.delete(studyMaterials).where(condition)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
