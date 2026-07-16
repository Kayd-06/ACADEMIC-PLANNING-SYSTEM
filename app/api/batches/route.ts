import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { batches, batchPrograms, students, programs, faculty, teacherBatches, type NewBatch } from '@/lib/db/schema'
import { eq, and, asc, isNull, inArray, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const CLASS_LEVELS = ['', '9', '10', '11', '12', 'Dropper']
const FIELDS = ['name', 'classLevel', 'capacity', 'startDate', 'endDate', 'teacherId'] as const

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
  // class_level is NOT NULL DEFAULT '' — an unselected "Select…" option must
  // map back to '', not null, or the update/insert violates that constraint.
  if (data.classLevel === null) data.classLevel = ''
  return data
}

function schoolCondition(schoolId: string | null) {
  return schoolId ? eq(batches.schoolId, schoolId) : isNull(batches.schoolId)
}

// Replace a batch's full set of program links with the given list
async function setBatchPrograms(batchId: string, programIds: string[] | undefined) {
  if (programIds === undefined) return
  await db.delete(batchPrograms).where(eq(batchPrograms.batchId, batchId))
  const uniqueIds = [...new Set(programIds.filter(Boolean))]
  if (uniqueIds.length > 0) {
    await db.insert(batchPrograms).values(uniqueIds.map(programId => ({ batchId, programId })))
  }
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

// GET — list batches with their programs (array) and coordinator name
// (?programId= filters to batches linked to that program)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    await syncBatches(schoolId)

    const { searchParams } = new URL(req.url)
    const programIdFilter = searchParams.get('programId')

    let batchRows = await db.select().from(batches).where(schoolCondition(schoolId)).orderBy(asc(batches.name))

    if (programIdFilter) {
      const linked = await db.select({ batchId: batchPrograms.batchId }).from(batchPrograms)
        .where(eq(batchPrograms.programId, programIdFilter))
      const linkedIds = new Set(linked.map(l => l.batchId))
      batchRows = batchRows.filter(b => linkedIds.has(b.id))
    }

    const batchIds = batchRows.map(b => b.id)
    const teacherIds = [...new Set(batchRows.map(b => b.teacherId).filter((x): x is string => !!x))]

    const [programLinks, teacherRows] = await Promise.all([
      batchIds.length
        ? db.select({ batchId: batchPrograms.batchId, programId: programs.id, programName: programs.name })
            .from(batchPrograms)
            .innerJoin(programs, eq(batchPrograms.programId, programs.id))
            .where(inArray(batchPrograms.batchId, batchIds))
        : Promise.resolve([]),
      teacherIds.length
        ? db.select({ id: faculty.id, name: faculty.name }).from(faculty).where(inArray(faculty.id, teacherIds))
        : Promise.resolve([]),
    ])

    const teacherNameById = new Map(teacherRows.map(t => [t.id, t.name]))

    return NextResponse.json(batchRows.map(b => ({
      ...b,
      _id: b.id,
      programs: programLinks.filter(p => p.batchId === b.id).map(p => ({ id: p.programId, name: p.programName })),
      teacherName: b.teacherId ? (teacherNameById.get(b.teacherId) ?? null) : null,
    })))
  } catch (error: any) {
    // Drizzle wraps DB errors in a generic "Failed query: ..." message that
    // hides the actual Postgres reason (e.g. a constraint violation) — surface
    // the underlying cause when present so the real error is diagnosable.
    return NextResponse.json({ error: error.cause?.message ?? error.message }, { status: 500 })
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

// POST — create a batch (management only). Body may include programIds: string[]
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

    await setBatchPrograms(created.id, Array.isArray(body.programIds) ? body.programIds : undefined)
    await mirrorTeacherAssignment(created.teacherId, created.name)

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error: any) {
    // Drizzle wraps DB errors in a generic "Failed query: ..." message that
    // hides the actual Postgres reason (e.g. a constraint violation) — surface
    // the underlying cause when present so the real error is diagnosable.
    return NextResponse.json({ error: error.cause?.message ?? error.message }, { status: 500 })
  }
}

// PATCH — update a batch (?id=) (management only). Body may include
// programIds: string[] to replace the full set of linked programs.
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
    const hasProgramUpdate = Array.isArray(body.programIds)
    if (Object.keys(data).length === 0 && !hasProgramUpdate) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    if (data.classLevel && !CLASS_LEVELS.includes(data.classLevel)) {
      return NextResponse.json({ error: 'Class level must be 9, 10, 11, 12 or Dropper' }, { status: 400 })
    }

    const updated = Object.keys(data).length > 0
      ? (await db.update(batches).set({ ...data, updatedAt: new Date() }).where(eq(batches.id, id)).returning())[0]
      : existing

    // Cascade renames to the students that reference the old name
    if (data.name && data.name !== existing.name) {
      const studentCondition = schoolId
        ? and(eq(students.batch, existing.name), eq(students.schoolId, schoolId))
        : eq(students.batch, existing.name)
      await db.update(students).set({ batch: data.name, updatedAt: new Date() }).where(studentCondition)
    }

    await setBatchPrograms(id, hasProgramUpdate ? body.programIds : undefined)
    await mirrorTeacherAssignment(updated.teacherId, updated.name)

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error: any) {
    // Drizzle wraps DB errors in a generic "Failed query: ..." message that
    // hides the actual Postgres reason (e.g. a constraint violation) — surface
    // the underlying cause when present so the real error is diagnosable.
    return NextResponse.json({ error: error.cause?.message ?? error.message }, { status: 500 })
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
    // Drizzle wraps DB errors in a generic "Failed query: ..." message that
    // hides the actual Postgres reason (e.g. a constraint violation) — surface
    // the underlying cause when present so the real error is diagnosable.
    return NextResponse.json({ error: error.cause?.message ?? error.message }, { status: 500 })
  }
}
