import { NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { db } from '@/lib/db'
import { teacherBatches, teacherPrograms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { findTeacherFaculty } from '@/lib/db/queries/faculty'

export const dynamic = 'force-dynamic'

// GET — the signed-in teacher's own assigned programs & batches (unique
// names), used to scope the sidebar Program/Batch switchers and the
// student roster to only what this teacher has been given.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers have assignments' }, { status: 403 })
  }

  const schoolId = getSchoolId(session)

  const profile = await findTeacherFaculty(session.user.id!, session.user.email ?? '', schoolId)

  if (!profile) {
    return NextResponse.json({ programs: [], batches: [] })
  }

  const [programRows, batchRows] = await Promise.all([
    db.select({ name: teacherPrograms.programName }).from(teacherPrograms).where(eq(teacherPrograms.teacherId, profile.id)),
    db.select({ name: teacherBatches.batchName }).from(teacherBatches).where(eq(teacherBatches.teacherId, profile.id)),
  ])

  return NextResponse.json({
    programs: [...new Set(programRows.map(r => r.name).filter(Boolean))],
    batches: [...new Set(batchRows.map(r => r.name).filter(Boolean))],
  })
}
