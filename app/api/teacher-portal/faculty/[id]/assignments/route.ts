import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { faculty, teacherSubjects, teacherBatches, teacherPrograms } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const BATCH_ROLES = ['primary', 'substitute', 'assistant']

async function verifyTeacher(id: string, schoolId: string | null) {
  const condition = schoolId ? and(eq(faculty.id, id), eq(faculty.schoolId, schoolId)) : eq(faculty.id, id)
  const [t] = await db.select({ id: faculty.id }).from(faculty).where(condition)
  return !!t
}

async function guard(req: NextRequest, params: Promise<{ id: string }>) {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((session.user as any).role !== 'management') {
    return { error: NextResponse.json({ error: 'Only management can manage assignments' }, { status: 403 }) }
  }
  const schoolId = (session.user as any).schoolId as string | null
  const { id } = await params
  if (!(await verifyTeacher(id, schoolId))) {
    return { error: NextResponse.json({ error: 'Teacher not found' }, { status: 404 }) }
  }
  return { id }
}

// GET — list a teacher's subject, batch, and program assignments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [subjects, batches, programs] = await Promise.all([
    db.select().from(teacherSubjects).where(eq(teacherSubjects.teacherId, id)),
    db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, id)),
    db.select().from(teacherPrograms).where(eq(teacherPrograms.teacherId, id)),
  ])
  return NextResponse.json({ subjects, batches, programs })
}

// POST — add an assignment. Body: { type: 'subject'|'batch', ...fields }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, params)
  if ('error' in g) return g.error

  const body = await req.json()
  if (body.type === 'subject') {
    if (!body.subjectName?.trim()) return NextResponse.json({ error: 'subjectName is required' }, { status: 400 })
    const [row] = await db.insert(teacherSubjects).values({
      teacherId: g.id,
      subjectName: body.subjectName.trim(),
      programName: body.programName?.trim() || '',
      isPrimary: body.isPrimary !== undefined ? !!body.isPrimary : true,
    }).returning()
    return NextResponse.json(row, { status: 201 })
  }
  if (body.type === 'batch') {
    if (!body.batchName?.trim()) return NextResponse.json({ error: 'batchName is required' }, { status: 400 })
    if (body.role && !BATCH_ROLES.includes(body.role)) {
      return NextResponse.json({ error: `role must be one of: ${BATCH_ROLES.join(', ')}` }, { status: 400 })
    }
    const [row] = await db.insert(teacherBatches).values({
      teacherId: g.id,
      batchName: body.batchName.trim(),
      subjectName: body.subjectName?.trim() || '',
      role: body.role || 'primary',
      assignedAt: body.assignedAt || new Date().toISOString().split('T')[0],
    }).returning()
    return NextResponse.json(row, { status: 201 })
  }
  if (body.type === 'program') {
    if (!body.programName?.trim()) return NextResponse.json({ error: 'programName is required' }, { status: 400 })
    const [row] = await db.insert(teacherPrograms).values({
      teacherId: g.id,
      programName: body.programName.trim(),
      isPrimary: body.isPrimary !== undefined ? !!body.isPrimary : true,
    }).returning()
    return NextResponse.json(row, { status: 201 })
  }
  return NextResponse.json({ error: 'type must be "subject", "batch", or "program"' }, { status: 400 })
}

// DELETE — remove an assignment (?type=subject|batch|program&assignmentId=)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, params)
  if ('error' in g) return g.error

  const type = req.nextUrl.searchParams.get('type')
  const assignmentId = req.nextUrl.searchParams.get('assignmentId')
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })

  if (type === 'subject') {
    await db.delete(teacherSubjects).where(and(eq(teacherSubjects.id, assignmentId), eq(teacherSubjects.teacherId, g.id)))
  } else if (type === 'batch') {
    await db.delete(teacherBatches).where(and(eq(teacherBatches.id, assignmentId), eq(teacherBatches.teacherId, g.id)))
  } else if (type === 'program') {
    await db.delete(teacherPrograms).where(and(eq(teacherPrograms.id, assignmentId), eq(teacherPrograms.teacherId, g.id)))
  } else {
    return NextResponse.json({ error: 'type must be "subject", "batch", or "program"' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
