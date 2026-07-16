import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students, parentsGuardians, type NewParentGuardian } from '@/lib/db/schema'
import { eq, and, ne, desc, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const GUARDIAN_FIELDS = [
  'name', 'relationship', 'isPrimary',
  'email', 'phone', 'altPhone',
  'occupation', 'annualIncome', 'addressLine1', 'city', 'state', 'pincode',
] as const

function pickGuardianFields(body: any): Partial<NewParentGuardian> {
  const data: Record<string, any> = {}
  for (const f of GUARDIAN_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

const PHONE_REGEX = /^\d{10}$/

// Any other guardian on this student already using this phone number
// (excluding the guardian being edited, if any).
async function findDuplicatePhone(studentId: string, phone: string, excludeGuardianId?: string) {
  const conditions = [eq(parentsGuardians.studentId, studentId), eq(parentsGuardians.phone, phone)]
  if (excludeGuardianId) conditions.push(ne(parentsGuardians.id, excludeGuardianId))
  const [existing] = await db.select({ id: parentsGuardians.id }).from(parentsGuardians).where(and(...conditions))
  return !!existing
}

async function verifyStudentAccess(studentId: string, schoolId: string | null) {
  const condition = schoolId
    ? and(eq(students.id, studentId), eq(students.schoolId, schoolId))
    : eq(students.id, studentId)
  const [student] = await db.select({ id: students.id }).from(students).where(condition)
  return !!student
}

// GET — list guardians for a student
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const guardians = await db.select().from(parentsGuardians)
      .where(eq(parentsGuardians.studentId, id))
      .orderBy(desc(parentsGuardians.isPrimary), asc(parentsGuardians.createdAt))
    return NextResponse.json(guardians)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a guardian (management only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can add guardians' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = pickGuardianFields(body)
    if (!data.name) return NextResponse.json({ error: 'Guardian name is required' }, { status: 400 })
    if (data.phone) {
      if (!PHONE_REGEX.test(data.phone)) {
        return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 })
      }
      if (await findDuplicatePhone(id, data.phone)) {
        return NextResponse.json({ error: 'A guardian with this phone number already exists for this student' }, { status: 409 })
      }
    }

    // Only one primary guardian per student
    if (data.isPrimary) {
      await db.update(parentsGuardians).set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(parentsGuardians.studentId, id))
    }

    const [guardian] = await db.insert(parentsGuardians)
      .values({ ...data, name: data.name!, studentId: id })
      .returning()
    return NextResponse.json(guardian, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a guardian (?guardianId=) (management only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit guardians' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const guardianId = req.nextUrl.searchParams.get('guardianId')
    if (!guardianId) return NextResponse.json({ error: 'guardianId is required' }, { status: 400 })

    const body = await req.json()
    const data = pickGuardianFields(body)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    if (data.phone) {
      if (!PHONE_REGEX.test(data.phone)) {
        return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 })
      }
      if (await findDuplicatePhone(id, data.phone, guardianId)) {
        return NextResponse.json({ error: 'A guardian with this phone number already exists for this student' }, { status: 409 })
      }
    }

    if (data.isPrimary) {
      await db.update(parentsGuardians).set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(parentsGuardians.studentId, id), ne(parentsGuardians.id, guardianId)))
    }

    const [guardian] = await db.update(parentsGuardians)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(parentsGuardians.id, guardianId), eq(parentsGuardians.studentId, id)))
      .returning()
    if (!guardian) return NextResponse.json({ error: 'Guardian not found' }, { status: 404 })

    return NextResponse.json(guardian)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a guardian (?guardianId=) (management only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove guardians' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params
    if (!(await verifyStudentAccess(id, schoolId))) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const guardianId = req.nextUrl.searchParams.get('guardianId')
    if (!guardianId) return NextResponse.json({ error: 'guardianId is required' }, { status: 400 })

    await db.delete(parentsGuardians)
      .where(and(eq(parentsGuardians.id, guardianId), eq(parentsGuardians.studentId, id)))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
