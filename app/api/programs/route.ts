import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { programs, batches, programSubjects, students, type NewProgram } from '@/lib/db/schema'
import { eq, and, asc, inArray, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const PROGRAM_TYPES = ['JEE', 'NEET', 'Foundational', 'Other']
const FIELDS = ['code', 'name', 'type', 'targetExam', 'duration', 'isActive', 'colorTheme'] as const

function pickFields(body: any): Partial<NewProgram> {
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
  }
  return data
}

// GET — list programs with live batch/student/subject counts
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const rows = schoolId
      ? await db.select().from(programs).where(eq(programs.schoolId, schoolId)).orderBy(asc(programs.createdAt))
      : await db.select().from(programs).orderBy(asc(programs.createdAt))

    const ids = rows.map(p => p.id)
    const studentCondition = schoolId
      ? and(eq(students.isActive, true), eq(students.schoolId, schoolId))
      : eq(students.isActive, true)

    const [batchCountRows, subjectRows, studentCountRows] = ids.length
      ? await Promise.all([
          db.select({ programId: batches.programId, value: count() })
            .from(batches).where(inArray(batches.programId, ids)).groupBy(batches.programId),
          db.select({ programId: programSubjects.programId })
            .from(programSubjects).where(inArray(programSubjects.programId, ids)),
          // Count students by their own `program` field, not batch enrollment.
          db.select({ program: students.program, value: count() })
            .from(students).where(studentCondition).groupBy(students.program),
        ])
      : [[], [], []]

    const batchCountByProgramId = new Map(batchCountRows.map(r => [r.programId, Number(r.value)]))
    const studentCountByName = new Map(studentCountRows.map(r => [r.program, Number(r.value)]))

    const result = rows.map(p => {
      return {
        ...p,
        _id: p.id,
        // Legacy aliases kept for older consumers
        title: p.name,
        target: p.targetExam,
        batches: batchCountByProgramId.get(p.id) ?? 0,
        students: studentCountByName.get(p.name) ?? 0,
        subjects: subjectRows.filter(s => s.programId === p.id).length,
      }
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a program (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can create programs' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const data = pickFields(body)
    // Legacy form compat
    if (!data.name && body.title) data.name = String(body.title).trim()
    if (!data.targetExam && body.target) data.targetExam = String(body.target).trim()

    if (!data.name) return NextResponse.json({ error: 'Program name is required' }, { status: 400 })
    if (data.type && !PROGRAM_TYPES.includes(data.type)) {
      return NextResponse.json({ error: `Type must be one of: ${PROGRAM_TYPES.join(', ')}` }, { status: 400 })
    }

    const [created] = await db.insert(programs).values({
      ...(data as NewProgram),
      name: data.name,
      schoolId,
    }).returning()

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a program (?id=) (management only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit programs' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const data = pickFields(body)
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    if (data.type && !PROGRAM_TYPES.includes(data.type)) {
      return NextResponse.json({ error: `Type must be one of: ${PROGRAM_TYPES.join(', ')}` }, { status: 400 })
    }

    const condition = schoolId ? and(eq(programs.id, id), eq(programs.schoolId, schoolId)) : eq(programs.id, id)
    const [updated] = await db.update(programs)
      .set({ ...data, updatedAt: new Date() })
      .where(condition)
      .returning()
    if (!updated) return NextResponse.json({ error: 'Program not found' }, { status: 404 })

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a program (?id=) (management only; its batches survive, unlinked)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can delete programs' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const condition = schoolId ? and(eq(programs.id, id), eq(programs.schoolId, schoolId)) : eq(programs.id, id)
    await db.delete(programs).where(condition)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
