import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { faculty, teacherSubjects, teacherBatches, type NewFaculty } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Fields a teacher may edit on their own faculty record. Deliberately
// excludes email (tied to the login account) and status (an HR/admin
// designation of employment state).
const SELF_EDIT_FIELDS = [
  'employeeId', 'name', 'dob', 'gender', 'bio', 'profileImgUrl',
  'phone', 'altPhone', 'addressLine1', 'city', 'state', 'pincode',
  'subject', 'specialization', 'batches', 'experience', 'experienceYears', 'primaryStream', 'joiningDate',
] as const

function pickSelfEditFields(body: any): Partial<NewFaculty> {
  const data: Record<string, any> = {}
  for (const f of SELF_EDIT_FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  if (data.experienceYears !== undefined) {
    data.experienceYears = data.experienceYears === '' ? null : Number(data.experienceYears)
    // Keep the legacy display string (faculty.experience, used by the Faculty
    // Directory table) in sync — the edit form only collects years.
    data.experience = data.experienceYears != null ? `${data.experienceYears} years` : ''
  }
  if (data.batches !== undefined) data.batches = Number(data.batches) || 0
  return data
}

// GET — the signed-in teacher's own faculty profile (matched by user_id or email)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers have a faculty profile' }, { status: 403 })
  }

  const [profile] = await db.select().from(faculty).where(
    or(eq(faculty.userId, session.user.id!), eq(faculty.email, session.user.email ?? ''))
  ).limit(1)

  if (!profile) {
    return NextResponse.json({ profile: null, subjects: [], batches: [] })
  }

  const [subjects, batches] = await Promise.all([
    db.select().from(teacherSubjects).where(eq(teacherSubjects.teacherId, profile.id)),
    db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, profile.id)),
  ])

  return NextResponse.json({ profile, subjects, batches })
}

// PATCH — a teacher updates their own faculty record
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can use this endpoint' }, { status: 403 })
  }

  const [existing] = await db.select({ id: faculty.id }).from(faculty).where(
    or(eq(faculty.userId, session.user.id!), eq(faculty.email, session.user.email ?? ''))
  ).limit(1)
  if (!existing) {
    return NextResponse.json({ error: 'No faculty profile found yet — join a school first.' }, { status: 404 })
  }

  const body = await req.json()
  const data = pickSelfEditFields(body)
  if (!data.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const [updated] = await db.update(faculty)
    .set({ ...data, userId: session.user.id!, updatedAt: new Date() })
    .where(eq(faculty.id, existing.id))
    .returning()

  return NextResponse.json(updated)
}
