import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { batches, students, programs, faculty, teacherBatches, type NewBatch } from '@/lib/db/schema'
import { eq, and, asc, isNull, inArray, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const CLASS_LEVELS = ['', '9', '10', '11', '12', 'Dropper']
const FIELDS = ['name', 'classLevel', 'capacity', 'startDate', 'endDate', 'programId', 'teacherId'] as const

function pickFields(body: any): Partial<NewBatch> {
  const data: Record<string, any> = {}
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      const v = body[f]
      data[f] = typeof v === 'string' ? (v.trim() || null) : v
    }
  }
  if (data.capacity !== undefined) data.capacity = Number(data.capacity) || 60
  if (data.name === null) delete data.name
  return data
}

function schoolCondition(schoolId: string | null) {
  return schoolId ? eq(batches.schoolId, schoolId) : isNull(batches.schoolId)
}

// Keep batch rows aligned with the students table: create rows for batch
// names that only exist on students, refresh enrolled counts, and make sure
// a school always has at least "Batch 1".
async function syncBatches(schoolId: string | null) {
  const studentCondition = schoolId
    ? and(eq(students.isActive, true), eq(students.schoolId, schoolId))
    : eq(students.isActive, true)

  const countsRows = await db
    .select({ batch: students.batch, value: count() })
    .from(students)
    .where(studentCondition)
    .groupBy(students.batch)
  const countsByName = new Map(countsRows.filter(r => r.batch !== '').map(r => [r.batch, Number(r.value)]))

  const existing = await db.select().from(batches).where(schoolCondition(schoolId))
  const existingNames = new Set(existing.map(b => b.name))

  // New names discovered on students (e.g. CSV imports)
  const missing = [...countsByName.keys()].filter(name => !existingNames.has(name))
  if (missing.length > 0) {
    await db.insert(batches).values(missing.map(name => ({
      name,
      enrolledCount: countsByName.get(name) ?? 0,
      schoolId,
    })))
  }

  // Refresh drifted enrolled counts
  for (const b of existing) {
    const actual = countsByName.get(b.name) ?? 0
    if (actual !== b.enrolledCount) {
      await db.update(batches).set({ enrolledCount: actual, updatedAt: new Date() }).where(eq(batches.id, b.id))
    }
  }

  // Default batch so the switcher and roster always have something to attach to
  if (existing.length === 0 && missing.length === 0) {
    await db.insert(batches).values({ name: 'Batch 1', schoolId })
  }
}

// GET — list batches with program and coordinator names (?programId= filter)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    await syncBatches(schoolId)

    const { searchParams } = new URL(req.url)
    const programId = searchParams.get('programId')

    const conditions = [schoolCondition(schoolId)]
    if (programId) conditions.push(eq(batches.programId, programId))

    const rows = await db.select({
      batch: batches,
      programName: programs.name,
      teacherName: faculty.name,
    })
      .from(batches)
      .leftJoin(programs, eq(batches.programId, programs.id))
      .leftJoin(faculty, eq(batches.teacherId, faculty.id))
      .where(and(...conditions))
      .orderBy(asc(batches.name))

    return NextResponse.json(rows.map(r => ({
      ...r.batch,
      _id: r.batch.id,
      programName: r.programName ?? null,
      teacherName: r.teacherName ?? null,
    })))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Mirror the coordinator assignment into the teacher's own batch list
async function mirrorTeacherAssignment(teacherId: string | null | undefined, batchName: string) {
  if (!teacherId) return
  const [existing] = await db.select({ id: teacherBatches.id }).from(teacherBatches)
    .where(and(eq(teacherBatches.teacherId, teacherId), eq(teacherBatches.batchName, batchName)))
  if (!existing) {
    await db.insert(teacherBatches).values({
      teacherId,
      batchName,
      role: 'primary',
      assignedAt: new Date().toISOString().split('T')[0],
    })
  }
}

// POST — create a batch (management only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can create batches' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const data = pickFields(body)
    if (!data.name) return NextResponse.json({ error: 'Batch name is required' }, { status: 400 })
    if (data.classLevel && !CLASS_LEVELS.includes(data.classLevel)) {
      return NextResponse.json({ error: 'Class level must be 9, 10, 11, 12 or Dropper' }, { status: 400 })
    }

    const [duplicate] = await db.select({ id: batches.id }).from(batches)
      .where(and(schoolCondition(schoolId), eq(batches.name, data.name)))
    if (duplicate) return NextResponse.json({ error: 'A batch with that name already exists' }, { status: 409 })

    const [created] = await db.insert(batches).values({
      ...(data as NewBatch),
      name: data.name,
      schoolId,
    }).returning()

    await mirrorTeacherAssignment(created.teacherId, created.name)

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a batch (?id=) (management only).
// Renaming a batch also renames students.batch so the roster stays linked.
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit batches' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const [existing] = await db.select().from(batches).where(and(eq(batches.id, id), schoolCondition(schoolId)))
    if (!existing) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const body = await req.json()
    const data = pickFields(body)
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    if (data.classLevel && !CLASS_LEVELS.includes(data.classLevel)) {
      return NextResponse.json({ error: 'Class level must be 9, 10, 11, 12 or Dropper' }, { status: 400 })
    }

    const [updated] = await db.update(batches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(batches.id, id))
      .returning()

    // Cascade renames to the students that reference the old name
    if (data.name && data.name !== existing.name) {
      const studentCondition = schoolId
        ? and(eq(students.batch, existing.name), eq(students.schoolId, schoolId))
        : eq(students.batch, existing.name)
      await db.update(students).set({ batch: data.name, updatedAt: new Date() }).where(studentCondition)
    }

    await mirrorTeacherAssignment(updated.teacherId, updated.name)

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a batch (?id=) (management only; students keep their batch label)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can delete batches' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const [existing] = await db.select().from(batches).where(and(eq(batches.id, id), schoolCondition(schoolId)))
    if (!existing) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    if (existing.enrolledCount > 0) {
      return NextResponse.json({ error: `"${existing.name}" still has ${existing.enrolledCount} students — move them to another batch first.` }, { status: 400 })
    }

    await db.delete(batches).where(eq(batches.id, id))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
