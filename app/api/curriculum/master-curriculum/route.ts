import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listMasterCurriculumRows,
  insertMasterCurriculumRow,
  updateMasterCurriculumRow,
  deleteMasterCurriculumRow,
} from '@/lib/db/queries/master-curriculum'

export const dynamic = 'force-dynamic'

// GET — list master curriculum rows with optional filters
// ?board=CBSE &program=JEE &classLevel=11 &subject=Physics &isActive=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const filters = {
      board:      searchParams.get('board')      || null,
      program:    searchParams.get('program')    || null,
      classLevel: searchParams.get('classLevel') || null,
      subject:    searchParams.get('subject')    || null,
      isActive:   searchParams.get('isActive') !== 'false' ? true : undefined,
    }

    const rows = await listMasterCurriculumRows(filters, schoolId)
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('master-curriculum GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — insert a new master curriculum row
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

    const body = await req.json()
    const { board, program, classLevel, subject, chapterName, conceptName } = body
    if (!board || !program || !classLevel || !subject || !chapterName || !conceptName) {
      return NextResponse.json({ error: 'board, program, classLevel, subject, chapterName, and conceptName are required' }, { status: 400 })
    }

    const row = await insertMasterCurriculumRow({ ...body, schoolId })
    return NextResponse.json(row, { status: 201 })
  } catch (error: any) {
    console.error('master-curriculum POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a master curriculum row by ?id=
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const row = await updateMasterCurriculumRow(id, body, schoolId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (error: any) {
    console.error('master-curriculum PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — soft-delete by ?id=
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await deleteMasterCurriculumRow(id, schoolId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('master-curriculum DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
