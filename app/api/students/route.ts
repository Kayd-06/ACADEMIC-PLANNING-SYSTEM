import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  type ListStudentsFilters,
} from '@/lib/db/queries/students'
import type { NewStudent, Student } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function toApiShape(student: Student) {
  const { id, ...rest } = student
  return { _id: id, ...rest }
}

// All writable student fields (chart: Identification, Contact & Address,
// Personal Details, Academic History, Status & Metadata)
const STUDENT_FIELDS = [
  'name', 'admissionNumber', 'aadharNumber', 'rollNo',
  'email', 'phone', 'addressLine1', 'city', 'state', 'pincode',
  'dob', 'gender', 'bloodGroup', 'profileImgUrl',
  'previousSchool', 'previousPercentage', 'class', 'program', 'batch', 'parentContact',
  'admissionDate', 'status', 'notes', 'isActive',
] as const

function pickStudentFields(body: any): Partial<NewStudent> {
  const data: Record<string, any> = {}
  for (const f of STUDENT_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  // Keep status and isActive consistent when only one is sent
  if (data.status !== undefined && data.isActive === undefined) data.isActive = data.status === 'active'
  if (data.isActive !== undefined && data.status === undefined) data.status = data.isActive ? 'active' : 'inactive'
  return data
}

function phoneLengthError(data: Partial<NewStudent>): string | null {
  if (typeof data.phone === 'string' && data.phone.length > 10) return 'Phone number cannot exceed 10 characters.'
  if (typeof data.parentContact === 'string' && data.parentContact.length > 10) return 'Parent contact number cannot exceed 10 characters.'
  return null
}

// GET — fetch students, optionally filtered by class & section
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const classFilter = searchParams.get('class')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const filters: ListStudentsFilters = { activeOnly, schoolId }
    if (classFilter) filters.class = classFilter

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

    const schoolId = (session.user as any).schoolId as string | null
    const body = await req.json()
    const data = pickStudentFields(body)

    if (!data.name) {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    }
    const phoneError = phoneLengthError(data)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })

    const student = await createStudent({
      ...data,
      name: data.name,
      rollNo: data.rollNo ?? '',
      class: data.class ?? '',
      program: data.program ?? '',
      batch: data.batch ?? '',
      schoolId,
    })
    return NextResponse.json(toApiShape(student), { status: 201 })
  } catch (error: any) {
    if (error.code === '23505' || error.cause?.code === '23505') {
      return NextResponse.json({ error: 'A student with that roll number already exists in this class.' }, { status: 409 })
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

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    const body = await req.json()
    const updateData = pickStudentFields(body)
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const phoneError = phoneLengthError(updateData)
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 })

    const student = await updateStudent(id, updateData, schoolId)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    return NextResponse.json(toApiShape(student))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — permanently delete a student and their guardian/enrollment records (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove students' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    await deleteStudent(id, schoolId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
