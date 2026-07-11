import { eq, and, or, desc } from 'drizzle-orm'
import { db } from '../index'
import { faculty, teacherSubjects } from '../schema'

interface EnsureFacultyInput {
  userId: string
  schoolId: string
  name: string
  email: string
  department?: string | null
}

// Creates a minimal faculty directory record for a teacher the first time
// they become associated with a school (self-registration with a join code,
// or joining a school later from the profile menu). Management can fill in
// subject/specialization/qualification afterward via Edit or the profile modal.
// No-ops if a faculty row already links this user (or email) to the school.
export async function ensureFacultyRecord({ userId, schoolId, name, email, department }: EnsureFacultyInput) {
  const [existing] = await db.select({ id: faculty.id }).from(faculty).where(
    and(
      eq(faculty.schoolId, schoolId),
      or(eq(faculty.userId, userId), eq(faculty.email, email))
    )
  )
  if (existing) {
    // Backfill the link if an admin-created record matched by email only
    await db.update(faculty).set({ userId, updatedAt: new Date() }).where(eq(faculty.id, existing.id))
    return existing.id
  }

  // Carry personal/professional details forward from any faculty record
  // this teacher already has at another school, so switching schools (via
  // a new invite code) doesn't reset their profile back to blank — only
  // school-specific assignments (batches/programs) start fresh, since the
  // new school's admin assigns those.
  const [priorProfile] = await db.select().from(faculty)
    .where(or(eq(faculty.userId, userId), eq(faculty.email, email)))
    .orderBy(desc(faculty.updatedAt))
    .limit(1)

  const subject = department?.trim() || priorProfile?.subject || 'General'
  const [created] = await db.insert(faculty).values({
    userId,
    schoolId,
    name,
    email,
    subject,
    specialization: priorProfile?.specialization ?? '',
    batches: 0,
    experience: priorProfile?.experience ?? '',
    experienceYears: priorProfile?.experienceYears ?? null,
    qualification: priorProfile?.qualification ?? null,
    dob: priorProfile?.dob ?? null,
    gender: priorProfile?.gender ?? null,
    bio: priorProfile?.bio ?? null,
    profileImgUrl: priorProfile?.profileImgUrl ?? null,
    phone: priorProfile?.phone ?? null,
    altPhone: priorProfile?.altPhone ?? null,
    addressLine1: priorProfile?.addressLine1 ?? null,
    city: priorProfile?.city ?? null,
    state: priorProfile?.state ?? null,
    pincode: priorProfile?.pincode ?? null,
    primaryStream: priorProfile?.primaryStream ?? null,
    joiningDate: priorProfile?.joiningDate ?? null,
    status: 'ACTIVE',
    isActive: true,
  }).returning({ id: faculty.id })

  await db.insert(teacherSubjects).values({ teacherId: created.id, subjectName: subject, isPrimary: true })

  return created.id
}

// Resolves a teacher's own faculty record, scoped to their current school.
// A teacher who has ever joined more than one school ends up with one
// faculty row per school (see ensureFacultyRecord above); an unscoped
// lookup by userId/email alone would silently pick up a stale record from
// a different school instead of the one matching their active session.
export async function findTeacherFaculty(userId: string, email: string, schoolId: string | null) {
  const identityMatch = or(eq(faculty.userId, userId), eq(faculty.email, email))
  const condition = schoolId ? and(identityMatch, eq(faculty.schoolId, schoolId)) : identityMatch
  const [row] = await db.select().from(faculty).where(condition).limit(1)
  return row ?? null
}
