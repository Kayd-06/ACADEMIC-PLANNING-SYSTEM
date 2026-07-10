import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty, teacherSubjects, teacherBatches, teacherPrograms, users, type NewFaculty } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// All writable teacher fields (chart: Identities & Keys, Contact, Personal, Professional)
const FIELDS = [
  'employeeId',
  'name', 'dob', 'gender', 'bio', 'profileImgUrl',
  'email', 'phone', 'altPhone', 'addressLine1', 'city', 'state', 'pincode',
  'qualification', 'experienceYears', 'primaryStream', 'joiningDate', 'isActive',
  'subject', 'specialization', 'batches', 'experience', 'status',
] as const

function pickFields(body: any): Partial<NewFaculty> {
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  if (data.experienceYears !== undefined) {
    data.experienceYears = Number(data.experienceYears) || null
    // Keep the legacy display string (faculty.experience, used by the Faculty
    // Directory table) in sync so it never drifts from experienceYears.
    data.experience = data.experienceYears != null ? `${data.experienceYears} years` : ''
  }
  if (data.batches !== undefined) data.batches = Number(data.batches) || 0
  // Keep legacy status enum and isActive in sync
  if (data.isActive !== undefined && data.status === undefined) data.status = data.isActive ? 'ACTIVE' : 'INACTIVE'
  if (data.status !== undefined && data.isActive === undefined) data.isActive = data.status === 'ACTIVE'
  return data
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const list = schoolId
    ? await db.select().from(faculty).where(eq(faculty.schoolId, schoolId)).orderBy(faculty.name)
    : await db.select().from(faculty).orderBy(faculty.name)

  const ids = list.map(f => f.id)
  const [subjects, batchRows, programRows] = ids.length
    ? await Promise.all([
        db.select().from(teacherSubjects).where(inArray(teacherSubjects.teacherId, ids)),
        db.select().from(teacherBatches).where(inArray(teacherBatches.teacherId, ids)),
        db.select().from(teacherPrograms).where(inArray(teacherPrograms.teacherId, ids)),
      ])
    : [[], [], []]

  const withDetails = list.map(f => ({
    ...f,
    subjects: subjects.filter(s => s.teacherId === f.id),
    batchAssignments: batchRows.filter(b => b.teacherId === f.id),
    programAssignments: programRows.filter(p => p.teacherId === f.id),
  }))
  return NextResponse.json(withDetails)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') {
    return NextResponse.json({ error: 'Only management can add faculty' }, { status: 403 })
  }
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const data = pickFields(body)

  if (!data.name || !data.subject || !data.specialization) {
    return NextResponse.json({ error: 'name, subject, and specialization are required' }, { status: 400 })
  }

  // Link to a user account by email when one exists (chart: user_id FK)
  let userId: string | null = null
  if (data.email) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email as string))
    if (u) userId = u.id
  }

  try {
    const [created] = await db.insert(faculty).values({
      ...(data as NewFaculty),
      name: data.name!,
      subject: data.subject!,
      specialization: data.specialization!,
      userId,
      schoolId,
    }).returning()

    // Seed the primary subject assignment
    if (created.subject) {
      await db.insert(teacherSubjects).values({ teacherId: created.id, subjectName: created.subject, isPrimary: true })
    }
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error.code === '23505' || error.cause?.code === '23505') {
      return NextResponse.json({ error: 'A faculty member with that employee ID already exists in this school.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') {
    return NextResponse.json({ error: 'Only management can edit faculty' }, { status: 403 })
  }
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data = pickFields(body)
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const condition = schoolId ? and(eq(faculty.id, id), eq(faculty.schoolId, schoolId)) : eq(faculty.id, id)
  try {
    const [updated] = await db.update(faculty)
      .set({ ...data, updatedAt: new Date() })
      .where(condition)
      .returning()
    if (!updated) return NextResponse.json({ error: 'Faculty not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.code === '23505' || error.cause?.code === '23505') {
      return NextResponse.json({ error: 'A faculty member with that employee ID already exists in this school.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') {
    return NextResponse.json({ error: 'Only management can remove faculty' }, { status: 403 })
  }
  const schoolId = (session.user as any).schoolId as string | null

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(faculty.id, id), eq(faculty.schoolId, schoolId)) : eq(faculty.id, id)
  await db.delete(faculty).where(condition)
  return NextResponse.json({ success: true })
}
