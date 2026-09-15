import { NextRequest, NextResponse } from 'next/server'
import { db, faculty, teacherSubjects } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const schoolId = (session.user as any).schoolId as string | null

    const fCond = [eq(faculty.userId, session.user.id)]
    if (schoolId) fCond.push(eq(faculty.schoolId, schoolId))

    const [teacher] = await db.select({ id: faculty.id })
      .from(faculty)
      .where(and(...fCond))
      .limit(1)

    if (!teacher) {
      return NextResponse.json({ subjects: [] })
    }

    const subjects = await db.select({ subjectName: teacherSubjects.subjectName })
      .from(teacherSubjects)
      .where(eq(teacherSubjects.teacherId, teacher.id))

    const uniqueSubjects = Array.from(new Set(subjects.map(s => s.subjectName)))
    
    return NextResponse.json({ subjects: uniqueSubjects })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
