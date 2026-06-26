import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listStudents,
  createStudent,
  updateStudent,
  deactivateStudent,
  deleteStudent,
  type ListStudentsFilters,
} from '@/lib/db/queries/students'
import type { NewStudent, Student } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function toApiShape(student: Student) {
  const { id, ...rest } = student
  return { _id: id, ...rest }
}

// GET — fetch students, optionally filtered by class & section
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const classFilter = searchParams.get('class')
    const sectionFilter = searchParams.get('section')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const filters: ListStudentsFilters = { activeOnly }
    if (classFilter) filters.class = classFilter
    if (sectionFilter) filters.section = sectionFilter

    const rows = await listStudents(filters)
    return NextResponse.json(rows.map(toApiShape))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a single student (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can add students' }, { status: 403 })
    }

    const body = await req.json()
    const { name, rollNo, class: cls, section, program, batch, parentContact } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    }

    const student = await createStudent({
      name: name.trim(),
      rollNo: rollNo?.trim() || '',
      class: cls?.trim() || '',
      section: section?.trim() || '',
      program: program?.trim() || '',
      batch: batch?.trim() || '',
      parentContact: parentContact?.trim() || '',
    })
    return NextResponse.json(toApiShape(student), { status: 201 })
  } catch (error: any) {
    if (error.code === '23505' || error.cause?.code === '23505') {
      return NextResponse.json({ error: 'A student with that roll number already exists in this class and section.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a student record (management only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit students' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    const body = await req.json()
    const { name, rollNo, class: cls, section, program, batch, parentContact, isActive } = body
    const updateData: Partial<NewStudent> = {}
    if (name !== undefined) updateData.name = name
    if (rollNo !== undefined) updateData.rollNo = rollNo
    if (cls !== undefined) updateData.class = cls
    if (section !== undefined) updateData.section = section
    if (program !== undefined) updateData.program = program
    if (batch !== undefined) updateData.batch = batch
    if (parentContact !== undefined) updateData.parentContact = parentContact
    if (isActive !== undefined) updateData.isActive = isActive

    const student = await updateStudent(id, updateData)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    return NextResponse.json(toApiShape(student))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — soft-delete a student (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove students' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    if (permanent) {
      await deleteStudent(id)
    } else {
      await deactivateStudent(id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
