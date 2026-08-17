import { db, tests } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getSchoolId } from '@/lib/auth'

export async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return { test: null, forbidden: false }

  const role = (session.user as any)?.role
  const schoolId = getSchoolId(session)

  if (role !== 'teacher' && role !== 'management') return { test: null, forbidden: true }
  
  // Scoped to caller's school if schoolId is present on both session and test row
  if (schoolId && test.schoolId && test.schoolId !== schoolId) {
    return { test: null, forbidden: false }
  }

  return { test, forbidden: false }
}
