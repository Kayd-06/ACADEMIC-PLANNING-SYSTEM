import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { faculty, teacherBatches, teacherPrograms } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { listStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    const role = (session.user as any).role as string | undefined

    let students = await listStudents({ activeOnly: false, schoolId })

    // Teachers only see students in the programs/batches they've been
    // explicitly assigned to. A teacher with no assignments yet still sees
    // everyone (back-compat with accounts set up before this feature).
    if (role === 'teacher') {
      const [profile] = await db.select({ id: faculty.id }).from(faculty).where(
        or(eq(faculty.userId, session.user.id!), eq(faculty.email, session.user.email ?? ''))
      ).limit(1)

      if (profile) {
        const [programRows, batchRows] = await Promise.all([
          db.select({ name: teacherPrograms.programName }).from(teacherPrograms).where(eq(teacherPrograms.teacherId, profile.id)),
          db.select({ name: teacherBatches.batchName }).from(teacherBatches).where(eq(teacherBatches.teacherId, profile.id)),
        ])
        const programSet = new Set(programRows.map(r => r.name).filter(Boolean))
        const batchSet = new Set(batchRows.map(r => r.name).filter(Boolean))
        if (programSet.size > 0 || batchSet.size > 0) {
          students = students.filter(s =>
            (programSet.size === 0 || programSet.has(s.program)) &&
            (batchSet.size === 0 || batchSet.has(s.batch))
          )
        }
      }
    }

    students.sort((a, b) => {
      const classCompare = (a.class || '').localeCompare(b.class || '')
      if (classCompare !== 0) return classCompare
      const sectionCompare = (a.section || '').localeCompare(b.section || '')
      if (sectionCompare !== 0) return sectionCompare
      return a.name.localeCompare(b.name)
    })

    // Map to the required view format
    const roster = students.map((s) => {
      // Default color logic based on some hash or simple rotation
      const colors = ['bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700']
      const nameHash = s.name.length % colors.length

      const initials = s.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

      return {
        _id: s.id,
        roll: s.rollNo || 'N/A',
        name: s.name,
        class: `${s.class || 'N/A'} - ${s.section || 'N/A'}`,
        rawClass: s.class || '',
        rawSection: s.section || '',
        program: s.program || 'Unassigned',
        batch: s.batch || 'Unassigned',
        batchTheme: 'blue', // defaults
        initials,
        color: colors[nameHash],
        contact: s.parentContact || 'N/A',
        profileImgUrl: s.profileImgUrl || null,
        isActive: s.isActive
      }
    })

    return NextResponse.json(roster)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
