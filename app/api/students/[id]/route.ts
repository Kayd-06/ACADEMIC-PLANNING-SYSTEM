import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { students, parentsGuardians, studentBatchEnrollments } from '@/lib/db/schema'
import { eq, and, desc, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function studentCondition(id: string, schoolId: string | null) {
  return schoolId ? and(eq(students.id, id), eq(students.schoolId, schoolId)) : eq(students.id, id)
}

// GET — full student profile: all fields + guardians + batch enrollments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { id } = await params

    const [student] = await db.select().from(students).where(studentCondition(id, schoolId))
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const [guardians, enrollments] = await Promise.all([
      db.select().from(parentsGuardians)
        .where(eq(parentsGuardians.studentId, id))
        .orderBy(desc(parentsGuardians.isPrimary), asc(parentsGuardians.createdAt)),
      db.select().from(studentBatchEnrollments)
        .where(eq(studentBatchEnrollments.studentId, id))
        .orderBy(desc(studentBatchEnrollments.createdAt)),
    ])

    return NextResponse.json({ student: { _id: student.id, ...student }, guardians, enrollments })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
