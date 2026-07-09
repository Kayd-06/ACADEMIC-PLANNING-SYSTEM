import { eq, and, or } from 'drizzle-orm'
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

  const subject = department?.trim() || 'General'
  const [created] = await db.insert(faculty).values({
    userId,
    schoolId,
    name,
    email,
    subject,
    specialization: '',
    batches: 0,
    experience: '',
    status: 'ACTIVE',
    isActive: true,
  }).returning({ id: faculty.id })

  await db.insert(teacherSubjects).values({ teacherId: created.id, subjectName: subject, isPrimary: true })

  return created.id
}
