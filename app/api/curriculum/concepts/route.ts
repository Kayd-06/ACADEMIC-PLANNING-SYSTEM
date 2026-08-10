import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listConceptsByChapter,
  createConcept,
  updateConcept,
  deleteConcept,
} from '@/lib/db/queries/curriculum'
import type { NewConcept } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const CONCEPT_FIELDS = ['chapterId', 'name', 'code', 'orderIndex'] as const

function pickConceptFields(body: any): Partial<NewConcept> {
  const data: Record<string, any> = {}
  for (const f of CONCEPT_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

// GET — list concepts for a chapter (?chapterId=, required). Any staff role may read.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const chapterId = searchParams.get('chapterId')
    if (!chapterId) return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })

    const rows = await listConceptsByChapter(chapterId, schoolId)
    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a concept (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can create concepts' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const body = await req.json()
    const data = pickConceptFields(body)
    if (!data.chapterId) return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
    if (!data.name) return NextResponse.json({ error: 'Concept name is required' }, { status: 400 })

    const concept = await createConcept({ ...data, chapterId: data.chapterId, name: data.name, schoolId } as NewConcept)
    return NextResponse.json(concept, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a concept (?id=) (management only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit concepts' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Concept ID is required' }, { status: 400 })

    const body = await req.json()
    const data = pickConceptFields(body)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const concept = await updateConcept(id, data, schoolId)
    if (!concept) return NextResponse.json({ error: 'Concept not found' }, { status: 404 })
    return NextResponse.json(concept)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a concept (?id=) (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can delete concepts' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Concept ID is required' }, { status: 400 })

    await deleteConcept(id, schoolId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
