import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students, studentBatchEnrollments, type NewStudentBatchEnrollment } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ENROLLMENT_STATUSES = ['active', 'dropped', 'transferred', 'completed']
const ENROLLMENT_FIELDS = ['batchName', 'rollNumber', 'enrollmentDate', 'status'] as const

function pickEnrollmentFields(body: any): Partial<NewStudentBatchEnrollment> {
  const data: Record<string, any> = {}
  for (const f of ENROLLMENT_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

async function verifyStudentAccess(studentId: string, schoolId: string | null) {
  const condition = schoolId
    ? and(eq(students.id, studentId), eq(students.schoolId, schoolId))
    : eq(students.id, studentId)
  const [student] = await db.select({ id: students.id }).from(students).where(condition)
  return !!student
}

// GET — list batch enrollments for a student
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const enrollments = await db.select().from(studentBatchEnrollments)
      .where(eq(studentBatchEnrollments.studentId, id))
      .orderBy(desc(studentBatchEnrollments.createdAt))
    return NextResponse.json(enrollments)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a batch enrollment (management only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can add enrollments' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = pickEnrollmentFields(body)
    if (!data.batchName) return NextResponse.json({ error: 'Batch name is required' }, { status: 400 })
    if (data.status && !ENROLLMENT_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: `Status must be one of: ${ENROLLMENT_STATUSES.join(', ')}` }, { status: 400 })
    }

    const [enrollment] = await db.insert(studentBatchEnrollments)
      .values({ ...data, batchName: data.batchName!, studentId: id })
      .returning()
    return NextResponse.json(enrollment, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update an enrollment (?enrollmentId=) (management only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit enrollments' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })

    const body = await req.json()
    const data = pickEnrollmentFields(body)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    if (data.status && !ENROLLMENT_STATUSES.includes(data.status)) {
      return NextResponse.json({ error: `Status must be one of: ${ENROLLMENT_STATUSES.join(', ')}` }, { status: 400 })
    }

    const [enrollment] = await db.update(studentBatchEnrollments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(studentBatchEnrollments.id, enrollmentId), eq(studentBatchEnrollments.studentId, id)))
      .returning()
    if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })

    return NextResponse.json(enrollment)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove an enrollment (?enrollmentId=) (management only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove enrollments' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')
    if (!enrollmentId) return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })

    await db.delete(studentBatchEnrollments)
      .where(and(eq(studentBatchEnrollments.id, enrollmentId), eq(studentBatchEnrollments.studentId, id)))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
