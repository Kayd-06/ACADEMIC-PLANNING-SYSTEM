import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Student from '@/models/Student'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch students, optionally filtered by class & section
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const classFilter = searchParams.get('class')
    const sectionFilter = searchParams.get('section')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const query: Record<string, any> = {}
    if (activeOnly) query.isActive = true
    if (classFilter) query.class = classFilter
    if (sectionFilter) query.section = sectionFilter

    const students = await Student.find(query).sort({ class: 1, section: 1, rollNo: 1 }).lean()
    return NextResponse.json(students)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a single student (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can add students' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { name, rollNo, class: cls, section, parentContact } = body

    if (!name || !rollNo || !cls || !section) {
      return NextResponse.json({ error: 'name, rollNo, class, and section are required' }, { status: 400 })
    }

    const student = await Student.create({ name, rollNo, class: cls, section, parentContact })
    return NextResponse.json(student, { status: 201 })
  } catch (error: any) {
    if (error.code === 11000) {
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

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    const body = await req.json()
    const student = await Student.findByIdAndUpdate(id, body, { new: true })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    return NextResponse.json(student)
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

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    if (permanent) {
      await Student.findByIdAndDelete(id)
    } else {
      await Student.findByIdAndUpdate(id, { isActive: false })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
