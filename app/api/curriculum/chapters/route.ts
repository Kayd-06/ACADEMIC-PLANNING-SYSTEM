import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listChaptersBySubject,
  createChapter,
  updateChapter,
  deleteChapter,
} from '@/lib/db/queries/curriculum'
import type { NewChapter } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const CHAPTER_FIELDS = ['subjectId', 'programId', 'name', 'code', 'board', 'classLevel', 'description', 'orderIndex', 'expectedHours'] as const

function pickChapterFields(body: any): Partial<NewChapter> {
  const data: Record<string, any> = {}
  for (const f of CHAPTER_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

// GET — list chapters for a subject (?subjectId=, required). Any staff role may read.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const subjectId = searchParams.get('subjectId')
    if (!subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })

    const rows = await listChaptersBySubject(subjectId, schoolId)
    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a chapter (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can create chapters' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const body = await req.json()
    const data = pickChapterFields(body)
    if (!data.subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    if (!data.name) return NextResponse.json({ error: 'Chapter name is required' }, { status: 400 })

    const chapter = await createChapter({ ...data, subjectId: data.subjectId, name: data.name, schoolId } as NewChapter)
    return NextResponse.json(chapter, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a chapter (?id=) (management only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit chapters' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 })

    const body = await req.json()
    const data = pickChapterFields(body)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const chapter = await updateChapter(id, data, schoolId)
    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    return NextResponse.json(chapter)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a chapter (?id=) (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can delete chapters' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 })

    await deleteChapter(id, schoolId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
