import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { faculty, teacherSubjects, teacherBatches } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

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
