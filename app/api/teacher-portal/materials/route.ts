import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { studyMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getSchoolId(session: any): string | null {
  const schoolId = session?.user?.schoolId
  if (!schoolId || schoolId === 'null' || schoolId === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
    return null
  }
  return schoolId
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = getSchoolId(session)

  const list = schoolId
    ? await db.select().from(studyMaterials).where(eq(studyMaterials.schoolId, schoolId)).orderBy(studyMaterials.createdAt)
    : await db.select().from(studyMaterials).orderBy(studyMaterials.createdAt)

  return NextResponse.json(list, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const formData = await req.formData()
    const provider = (formData.get('provider') as string) || ''
    const subject = (formData.get('subject') as string) || ''
    const type = (formData.get('type') as string) || 'PDF'
    const fileName = (formData.get('fileName') as string) || ''
    const title = (formData.get('title') as string) || ''
    const description = (formData.get('description') as string) || ''
    const subjectId = (formData.get('subjectId') as string) || ''
    const chapterId = (formData.get('chapterId') as string) || ''
    const programId = (formData.get('programId') as string) || ''
    const batchId = (formData.get('batchId') as string) || ''
    const isPublicStr = formData.get('isPublic') as string | null
    const isPublic = isPublicStr === 'false' ? false : true

    let fileUrl: string | null = null
    let fileSize: number | null = null
    const file = formData.get('file') as File | null
    if (file && file.name) {
      const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const blob = await put(`materials/${uniqueName}`, file, { access: 'private' })
      fileUrl = blob.url
      fileSize = Math.round(file.size / 1024) // size in KB
    }

    const [created] = await db.insert(studyMaterials).values({
      fileName: fileName || file?.name || title || provider,
      type,
      fileUrl,
      fileSize,
      subject,
      provider,
      schoolId,
      uploadedBy: session.user.name || session.user.email || 'Teacher',
      subjectId,
      chapterId,
      programId,
      batchId,
      title: title || fileName || file?.name || provider,
      description,
      isPublic,
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
    const schoolId = getSchoolId(session)

    const { id, provider, subject, type, title, description, isPublic, batchId, chapterId, programId, subjectId } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: any = {}
    if (provider !== undefined) updates.provider = provider
    if (subject !== undefined) updates.subject = subject
    if (type !== undefined) updates.type = type
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (isPublic !== undefined) updates.isPublic = isPublic
    if (batchId !== undefined) updates.batchId = batchId
    if (chapterId !== undefined) updates.chapterId = chapterId
    if (programId !== undefined) updates.programId = programId
    if (subjectId !== undefined) updates.subjectId = subjectId

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
    const schoolId = getSchoolId(session)

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
