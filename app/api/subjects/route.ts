import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { subjects } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Botany', 'Zoology']

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const rows = schoolId
      ? await db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name))
      : await db.select().from(subjects).orderBy(asc(subjects.name))

    const existingNames = new Set(rows.map(r => r.name))
    const missing = DEFAULT_SUBJECTS.filter(s => !existingNames.has(s))

    if (missing.length > 0 && schoolId) {
      try {
        const inserted = await db.insert(subjects).values(
          missing.map(name => ({
            name,
            code: name.substring(0, 3).toUpperCase(),
            description: `${name} subject`,
            schoolId,
          }))
        ).returning()
        rows.push(...inserted)
      } catch (e) {
        // Ignored if duplicate concurrent insert occurs
      }
    }

    const allSubjectNames = Array.from(new Set([...DEFAULT_SUBJECTS, ...rows.map(r => r.name)]))
    const result = allSubjectNames.map(name => ({ name }))

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
