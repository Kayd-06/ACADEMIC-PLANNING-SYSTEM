import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isUuid, requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { db } from '@/lib/db'
import { batches, students, programs, faculty, teacherBatches, schools, type NewBatch } from '@/lib/db/schema'
import { eq, and, asc, inArray, count } from 'drizzle-orm'
import { batchClassLevelOptions } from '@/lib/schoolClasses'
import { foreignRef, malformedRef, requestedRefs } from '@/lib/batches/refs'

export const dynamic = 'force-dynamic'

const FIELDS = ['name', 'classLevel', 'capacity', 'startDate', 'endDate', 'teacherId', 'programId'] as const

// The empty "Select…" option is always allowed regardless of the school's
// configured classes; real class levels must come from the school itself.
async function allowedClassLevels(schoolId: string): Promise<string[]> {
  const [school] = await db.select({ classes: schools.classes }).from(schools).where(eq(schools.id, schoolId))
  return ['', ...batchClassLevelOptions(school?.classes)]
}

// Postgres unique_violation — the batches_school_name_unique index is the
// source of truth; the app-level pre-checks below are a UX nicety, this
// catch is what actually stops a concurrent duplicate insert/rename.
// (errorResponse maps it to a 409.)

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

// teacherId / programId must be UUIDs of a faculty row / program of the
// caller's school; otherwise a batch could point at another tenant's records
// (and mirrorTeacherAssignment would add it to that teacher's list).
async function checkRefs(data: Partial<NewBatch>, schoolId: string): Promise<string | null> {
  const refs = requestedRefs(data)
  const malformed = malformedRef(refs)
  if (malformed) return malformed
  const [teacherRows, programRows] = await Promise.all([
    refs.teacherId
      ? db.select({ id: faculty.id }).from(faculty).where(and(eq(faculty.id, refs.teacherId), eq(faculty.schoolId, schoolId)))
      : Promise.resolve([]),
    refs.programId
      ? db.select({ id: programs.id }).from(programs).where(and(eq(programs.id, refs.programId), eq(programs.schoolId, schoolId)))
      : Promise.resolve([]),
  ])
  return foreignRef(refs, {
    teacherId: new Set(teacherRows.map(r => r.id)),
    programId: new Set(programRows.map(r => r.id)),
  })
}

function schoolCondition(schoolId: string) {
  return eq(batches.schoolId, schoolId)
}

// Live enrolled counts (active students per batch name) computed at read
// time. GET used to "sync" the batches table on every request (inserting
// rows and rewriting counts), which made a read do writes and raced with
// concurrent requests. The stored enrolled_count column is no longer trusted.
async function enrolledCountsByName(schoolId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ batch: students.batch, value: count() })
    .from(students)
    .where(and(eq(students.isActive, true), eq(students.schoolId, schoolId)))
    .groupBy(students.batch)
  return new Map(rows.filter(r => r.batch !== '').map(r => [r.batch, Number(r.value)]))
}

// teacher_batches rows that belong to this school (via the teacher's faculty row)
function teacherBatchesInSchool(schoolId: string, batchName: string) {
  return and(
    eq(teacherBatches.batchName, batchName),
    inArray(teacherBatches.teacherId, db.select({ id: faculty.id }).from(faculty).where(eq(faculty.schoolId, schoolId))),
  )
}

// GET — list batches with their program and coordinator name
// (?programId= filters to batches belonging to that program)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = requireSchool(session)
    const role = (session.user as any).role as string | undefined

    const { searchParams } = new URL(req.url)
    const programIdFilter = searchParams.get('programId')
    if (programIdFilter && !isUuid(programIdFilter)) {
      return NextResponse.json({ error: 'programId is not valid' }, { status: 400 })
    }

    const condition = programIdFilter
      ? and(schoolCondition(schoolId), eq(batches.programId, programIdFilter))
      : schoolCondition(schoolId)
    let batchRows = await db.select().from(batches).where(condition).orderBy(asc(batches.name))

    if (role === 'teacher') {
      const { findTeacherFaculty } = await import('@/lib/db/queries/faculty')
      const { teacherPrograms } = await import('@/lib/db/schema')
      const profile = await findTeacherFaculty(session.user.id!, session.user.email ?? '', schoolId)

      if (profile) {
        const [programRows, batchAssignments] = await Promise.all([
          db.select({ name: teacherPrograms.programName }).from(teacherPrograms).where(eq(teacherPrograms.teacherId, profile.id)),
          db.select({ name: teacherBatches.batchName }).from(teacherBatches).where(eq(teacherBatches.teacherId, profile.id)),
        ])
        const programSet = new Set(programRows.map(r => r.name).filter(Boolean))
        const batchSet = new Set(batchAssignments.map(r => r.name).filter(Boolean))

        if (programSet.size > 0 || batchSet.size > 0) {
          const programIdsForBatchRows = [...new Set(batchRows.map(b => b.programId).filter(Boolean))] as string[]
          let progNameById = new Map<string, string>()
          if (programIdsForBatchRows.length) {
            const pRows = await db.select({ id: programs.id, name: programs.name }).from(programs).where(inArray(programs.id, programIdsForBatchRows))
            progNameById = new Map(pRows.map(p => [p.id, p.name]))
          }

          batchRows = batchRows.filter(b => {
            const bProgName = b.programId ? (progNameById.get(b.programId) || '') : ''
            return (programSet.size === 0 || programSet.has(bProgName)) &&
                   (batchSet.size === 0 || batchSet.has(b.name))
          })
        }
      }
    }

    const teacherIds = [...new Set(batchRows.map(b => b.teacherId).filter((x): x is string => !!x))]
    const programIds = [...new Set(batchRows.map(b => b.programId).filter((x): x is string => !!x))]

    const [programRows, teacherRows] = await Promise.all([
      programIds.length
        ? db.select({ id: programs.id, name: programs.name }).from(programs).where(inArray(programs.id, programIds))
        : Promise.resolve([]),
      teacherIds.length
        ? db.select({ id: faculty.id, name: faculty.name }).from(faculty).where(inArray(faculty.id, teacherIds))
        : Promise.resolve([]),
    ])

    const programNameById = new Map(programRows.map(p => [p.id, p.name]))
    const teacherNameById = new Map(teacherRows.map(t => [t.id, t.name]))
    const counts = await enrolledCountsByName(schoolId)

    return NextResponse.json(batchRows.map(b => ({
      ...b,
      enrolledCount: counts.get(b.name) ?? 0,
      _id: b.id,
      programName: b.programId ? (programNameById.get(b.programId) ?? null) : null,
      teacherName: b.teacherId ? (teacherNameById.get(b.teacherId) ?? null) : null,
    })))
  } catch (error) {
    return errorResponse(error, 'GET /api/batches')
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

    const body = await req.json()
    const data = pickFields(body)
    if (!data.name) return NextResponse.json({ error: 'Batch name is required' }, { status: 400 })
    if (!data.startDate) return NextResponse.json({ error: 'Start date is required' }, { status: 400 })
    if (data.endDate && data.endDate < data.startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }
    const schoolId = requireSchool(session)
    const refError = await checkRefs(data, schoolId)
    if (refError) return NextResponse.json({ error: refError }, { status: 400 })
    if (data.classLevel) {
      const allowed = await allowedClassLevels(schoolId)
      if (!allowed.includes(data.classLevel)) {
        return NextResponse.json({ error: `Class level must be one of: ${allowed.filter(Boolean).join(', ')}` }, { status: 400 })
      }
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
  } catch (error) {
    return errorResponse(error, 'POST /api/batches', { conflictMessage: 'A batch with that name already exists' })
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

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!isUuid(id)) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    const schoolId = requireSchool(session)

    const [existing] = await db.select().from(batches).where(and(eq(batches.id, id), schoolCondition(schoolId)))
    if (!existing) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    const body = await req.json()
    const data = pickFields(body)
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const refError = await checkRefs(data, schoolId)
    if (refError) return NextResponse.json({ error: refError }, { status: 400 })
    const effectiveStartDate = data.startDate !== undefined ? data.startDate : existing.startDate
    const effectiveEndDate = data.endDate !== undefined ? data.endDate : existing.endDate
    if (!effectiveStartDate) return NextResponse.json({ error: 'Start date is required' }, { status: 400 })
    if (effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      return NextResponse.json({ error: 'End date cannot be before start date' }, { status: 400 })
    }
    if (data.classLevel) {
      const allowed = await allowedClassLevels(schoolId)
      if (!allowed.includes(data.classLevel)) {
        return NextResponse.json({ error: `Class level must be one of: ${allowed.filter(Boolean).join(', ')}` }, { status: 400 })
      }
    }

    if (data.name && data.name !== existing.name) {
      const [duplicate] = await db.select({ id: batches.id }).from(batches)
        .where(and(schoolCondition(schoolId), eq(batches.name, data.name)))
      if (duplicate) return NextResponse.json({ error: 'A batch with that name already exists' }, { status: 409 })
    }

    const updateBatch = db.update(batches).set({ ...data, updatedAt: new Date() })
      .where(and(eq(batches.id, id), schoolCondition(schoolId)))
      .returning()

    let updated: typeof batches.$inferSelect
    if (data.name && data.name !== existing.name) {
      // Rename the batch and cascade to students + teacher assignments in ONE
      // transaction, so a failure can't leave the roster pointing at a name
      // that no longer exists.
      const now = new Date()
      const [rows] = await db.batch([
        updateBatch,
        db.update(students).set({ batch: data.name, updatedAt: now })
          .where(and(eq(students.batch, existing.name), eq(students.schoolId, schoolId))),
        db.update(teacherBatches).set({ batchName: data.name })
          .where(teacherBatchesInSchool(schoolId, existing.name)),
      ])
      updated = rows[0]
    } else {
      updated = (await updateBatch)[0]
    }
    if (!updated) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

    await mirrorTeacherAssignment(updated.teacherId, updated.name)

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/batches', { conflictMessage: 'A batch with that name already exists' })
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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    if (!isUuid(id)) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    const schoolId = requireSchool(session)

    const [existing] = await db.select().from(batches).where(and(eq(batches.id, id), schoolCondition(schoolId)))
    if (!existing) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    const enrolled = (await enrolledCountsByName(schoolId)).get(existing.name) ?? 0
    if (enrolled > 0) {
      return NextResponse.json({ error: `"${existing.name}" still has ${enrolled} students — move them to another batch first.` }, { status: 400 })
    }

    await db.batch([
      db.delete(teacherBatches).where(teacherBatchesInSchool(schoolId, existing.name)),
      db.delete(batches).where(and(eq(batches.id, id), schoolCondition(schoolId))),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/batches')
  }
}
