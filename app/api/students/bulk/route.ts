import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { parentsGuardians, programs, batches, students as studentsTable } from '@/lib/db/schema'
import { deleteAllStudents } from '@/lib/db/queries/students'
import type { NewStudent } from '@/lib/db/schema'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'
import { buildStudentMatcher } from '@/lib/students/bulkMatch'

export const dynamic = 'force-dynamic'
// A few thousand rows used to fire thousands of parallel queries and time
// out; now they're chunked, but still give the function room.
export const maxDuration = 60

const CHUNK_SIZE = 100
const CONCURRENCY = 3

interface BulkDefaults {
  program?: string
  batch?: string
  section?: string
}

interface FieldError {
  row: string
  field: 'program' | 'batch' | 'general'
  value: string
  message: string
}

function resolveField(rowValue: string, defaultValue?: string): string {
  return defaultValue?.trim() ? defaultValue.trim() : rowValue
}

// Optional student fields the "Add Student" form and CSV template support.
// Absent/empty values never overwrite what is already stored.
const STUDENT_ROW_FIELDS = [
  'admissionNumber', 'aadharNumber',
  'email', 'phone', 'addressLine1', 'city', 'state', 'pincode',
  'dob', 'gender', 'bloodGroup', 'profileImgUrl',
  'previousSchool', 'previousPercentage', 'admissionDate', 'notes',
] as const
const OPTIONAL_COLUMNS: Record<(typeof STUDENT_ROW_FIELDS)[number] | 'batchId', string> = {
  admissionNumber: 'admission_number', aadharNumber: 'aadhar_number', email: 'email', phone: 'phone',
  addressLine1: 'address_line1', city: 'city', state: 'state', pincode: 'pincode', dob: 'dob',
  gender: 'gender', bloodGroup: 'blood_group', profileImgUrl: 'profile_img_url',
  previousSchool: 'previous_school', previousPercentage: 'previous_percentage',
  admissionDate: 'admission_date', notes: 'notes', batchId: 'batch_id',
}

// ON CONFLICT ... DO UPDATE SET: always-overwritten columns + COALESCE for optional ones.
function upsertSet() {
  const set: Record<string, any> = {
    name: sql.raw('excluded.name'),
    rollNo: sql.raw('excluded.roll_no'),
    class: sql.raw('excluded.class'),
    section: sql.raw('excluded.section'),
    program: sql.raw('excluded.program'),
    batch: sql.raw('excluded.batch'),
    parentContact: sql.raw('excluded.parent_contact'),
    status: sql.raw('excluded.status'),
    isActive: sql.raw('excluded.is_active'),
    updatedAt: sql`now()`,
  }
  for (const [field, column] of Object.entries(OPTIONAL_COLUMNS)) {
    set[field] = sql.raw(`coalesce(excluded.${column}, "students".${column})`)
  }
  return set
}

// Predicate of students_school_roll_class_section_unique (migration 0051).
const ROLL_KEY_PREDICATE = sql`"roll_no" <> '' AND "class" <> '' AND "school_id" IS NOT NULL`

interface PlannedRow {
  index: number
  /** earlier rows of the same file folded into this one */
  folded: number[]
  label: string
  student: NewStudent & { id: string }
  /** true -> new row with roll no + class: upsert on the natural key */
  keyed: boolean
  guardian: { name: string; relationship: string; phone: string | null; email: string | null } | null
}

// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    const body = await req.json()
    const { students, defaults } = body as { students: any[]; defaults?: BulkDefaults }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Only name is required; all other fields are optional
    const valid = students.filter((s: any) => typeof s?.name === 'string' && s.name.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }
    const schoolId = requireSchool(session)

    // One query each for the school's programs, batches and existing
    // students (previously 1–3 queries per row, all rows in parallel).
    const [schoolPrograms, schoolBatches, existing] = await Promise.all([
      db.select().from(programs).where(eq(programs.schoolId, schoolId)),
      db.select().from(batches).where(eq(batches.schoolId, schoolId)),
      db.select({
        id: studentsTable.id, rollNo: studentsTable.rollNo, class: studentsTable.class,
        section: studentsTable.section, admissionNumber: studentsTable.admissionNumber, name: studentsTable.name,
      }).from(studentsTable).where(eq(studentsTable.schoolId, schoolId)),
    ])
    const programByName = new Map(schoolPrograms.map((p) => [p.name.trim().toLowerCase(), p]))
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))
    const match = buildStudentMatcher(existing)

    const errors: Array<FieldError & { index: number }> = []
    const plannedByKey = new Map<string, PlannedRow>()
    const planned: PlannedRow[] = []

    valid.forEach((s: any, index: number) => {
      const name = s.name.trim()
      const rollNo = s.rollNo?.toString().trim() || ''
      const label = rollNo ? `${name} (Roll ${rollNo})` : name
      const cls = s.class?.toString().trim() || ''
      const rawSection = resolveField(s.section?.toString().trim() || '', defaults?.section)
      const program = resolveField(s.program?.trim() || '', defaults?.program)
      const batch = resolveField(s.batch?.trim() || '', defaults?.batch)
      const parentContact = s.parentContact?.toString().trim() || ''
      const status = s.status?.trim() || 'active'

      // Program/Batch must match a real, school-scoped record — CSV values and
      // modal defaults are free text with no other guarantee of correctness.
      const matchedProgram = program ? programByName.get(program.toLowerCase()) : undefined
      if (program && !matchedProgram) {
        errors.push({ index, row: label, field: 'program', value: program, message: `Program "${program}" does not exist. Create it first in Academic Planning, or fix the spelling.` })
        return
      }
      const matchedBatch = batch ? batchByName.get(batch.toLowerCase()) : undefined
      if (batch && !matchedBatch) {
        errors.push({ index, row: label, field: 'batch', value: batch, message: `Batch "${batch}" does not exist. Create it first in Academic Planning, or fix the spelling.` })
        return
      }
      if (matchedProgram && matchedBatch && matchedBatch.programId !== matchedProgram.id) {
        errors.push({ index, row: label, field: 'batch', value: batch, message: `Batch "${batch}" exists but belongs to a different Program, not "${program}".` })
        return
      }

      const admissionNumber = typeof s.admissionNumber === 'string' ? s.admissionNumber.trim() : ''
      const m = match({ name, rollNo, class: cls, section: rawSection, sectionProvided: rawSection !== '', admissionNumber })

      const student: NewStudent & { id: string } = {
        id: m.existingId ?? crypto.randomUUID(),
        name, rollNo, class: cls, section: m.section, program, batch, parentContact,
        status, isActive: status.toLowerCase() !== 'inactive',
        batchId: matchedBatch?.id ?? null,
        schoolId,
      }
      for (const f of STUDENT_ROW_FIELDS) {
        const v = s[f]
        if (typeof v === 'string' && v.trim()) (student as any)[f] = v.trim()
      }

      const guardianName = s.guardianName?.trim()
      const row: PlannedRow = {
        index,
        folded: [],
        label,
        student,
        keyed: !m.existingId && !!rollNo && !!cls,
        guardian: guardianName
          ? {
              name: guardianName,
              relationship: s.guardianRelationship?.trim() || 'Parent',
              phone: s.guardianPhone?.trim() || null,
              email: s.guardianEmail?.trim() || null,
            }
          : null,
      }

      // The same student twice in one file: the later row wins (one write
      // instead of two racing ones); both rows count as imported.
      if (m.dedupeKey) {
        const earlier = plannedByKey.get(m.dedupeKey)
        if (earlier) {
          row.student.id = earlier.student.id
          row.keyed = earlier.keyed
          row.folded = [...earlier.folded, earlier.index]
          if (!row.guardian) row.guardian = earlier.guardian
          planned[planned.indexOf(earlier)] = row
          plannedByKey.set(m.dedupeKey, row)
          return
        }
        plannedByKey.set(m.dedupeKey, row)
      }
      planned.push(row)
    })

    // Write in chunks of 100, 3 at a time. Each chunk's student rows are
    // written by at most two multi-row upserts inside one transaction.
    const chunks = chunk(planned, CHUNK_SIZE)
    const results = await mapWithConcurrency(chunks, CONCURRENCY, (part) => writeChunk(part, schoolId))

    let succeeded = 0
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded += result.value.saved
        for (const g of result.value.guardianErrors) errors.push(g)
        return
      }
      console.error('[students bulk import] chunk failed', result.reason)
      for (const r of chunks[i]) for (const index of [...r.folded, r.index]) {
        errors.push({ index, row: r.label, field: 'general', value: '', message: 'Could not be saved (it may conflict with another student). Please check the row and try again.' })
      }
    })

    errors.sort((a, b) => a.index - b.index)
    const publicErrors: FieldError[] = errors.map(({ index: _i, ...e }) => e)
    if (publicErrors.length > 0) console.error('Bulk import failures:', publicErrors.length)

    return NextResponse.json({ succeeded, failed: publicErrors.length, total: valid.length, errors: publicErrors }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/students/bulk')
  }
}

async function writeChunk(part: PlannedRow[], schoolId: string) {
  const byId = part.filter(r => !r.keyed)
  const keyed = part.filter(r => r.keyed)
  const returningCols = { id: studentsTable.id, rollNo: studentsTable.rollNo, class: studentsTable.class, section: studentsTable.section }

  // Existing students and new rows without a roll-number key: upsert on id
  // (only ever updating rows of this same school).
  const statements: any[] = []
  if (byId.length > 0) {
    statements.push(
      db.insert(studentsTable).values(byId.map(r => r.student))
        .onConflictDoUpdate({
          target: studentsTable.id,
          set: upsertSet(),
          setWhere: sql`"students"."school_id" = excluded.school_id`,
        })
        .returning(returningCols),
    )
  }
  // New rows with roll no + class: upsert on the natural unique key, so a
  // concurrent import of the same student updates instead of failing/duplicating.
  if (keyed.length > 0) {
    statements.push(
      db.insert(studentsTable).values(keyed.map(r => r.student))
        .onConflictDoUpdate({
          target: [studentsTable.schoolId, studentsTable.rollNo, studentsTable.class, studentsTable.section],
          targetWhere: ROLL_KEY_PREDICATE,
          set: upsertSet(),
        })
        .returning(returningCols),
    )
  }
  const results: Array<Array<{ id: string; rollNo: string; class: string; section: string }>> =
    await db.batch(statements as [any, ...any[]])

  const idByKey = new Map<string, string>()
  const savedIds = new Set<string>()
  for (const rows of results) for (const r of rows) {
    savedIds.add(r.id)
    idByKey.set(`${r.rollNo}|${r.class}|${r.section}`, r.id)
  }
  const finalId = (r: PlannedRow) =>
    r.keyed ? idByKey.get(`${r.student.rollNo}|${r.student.class}|${r.student.section}`) : (savedIds.has(r.student.id) ? r.student.id : undefined)

  let saved = 0
  const guardianRows: Array<{ row: PlannedRow; studentId: string }> = []
  for (const r of part) {
    const id = finalId(r)
    if (!id) continue
    saved += 1 + r.folded.length
    if (r.guardian) guardianRows.push({ row: r, studentId: id })
  }

  // Primary guardian: one prefetch + one multi-row upsert per chunk.
  const guardianErrors: Array<FieldError & { index: number }> = []
  if (guardianRows.length > 0) {
    try {
      const existingPrimary = await db.select({ id: parentsGuardians.id, studentId: parentsGuardians.studentId })
        .from(parentsGuardians)
        .where(and(inArray(parentsGuardians.studentId, guardianRows.map(g => g.studentId)), eq(parentsGuardians.isPrimary, true)))
      const primaryByStudent = new Map(existingPrimary.map(g => [g.studentId, g.id]))
      const values = new Map<string, typeof parentsGuardians.$inferInsert>()
      for (const { row, studentId } of guardianRows) {
        values.set(studentId, {
          id: primaryByStudent.get(studentId) ?? crypto.randomUUID(),
          studentId,
          isPrimary: true,
          name: row.guardian!.name,
          relationship: row.guardian!.relationship,
          phone: row.guardian!.phone,
          email: row.guardian!.email,
        })
      }
      await db.insert(parentsGuardians).values([...values.values()]).onConflictDoUpdate({
        target: parentsGuardians.id,
        set: {
          name: sql.raw('excluded.name'),
          relationship: sql.raw('excluded.relationship'),
          phone: sql.raw('coalesce(excluded.phone, "parents_guardians".phone)'),
          email: sql.raw('coalesce(excluded.email, "parents_guardians".email)'),
          updatedAt: sql`now()`,
        },
      })
    } catch (error) {
      console.error('[students bulk import] guardian upsert failed', error)
      for (const { row } of guardianRows) {
        guardianErrors.push({ index: row.index, row: row.label, field: 'general', value: '', message: 'Student saved, but the guardian details could not be saved.' })
      }
    }
  }

  return { saved, guardianErrors }
}

// DELETE — bulk delete all students (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    // Wiping the whole roster is a management-only action (teachers used to be
    // allowed too, which contradicted this handler's own contract).
    if (role !== 'management') {
      return NextResponse.json({ error: 'Only management can clear all rosters' }, { status: 403 })
    }

    // Never "no school = every school": without an active school this is refused.
    const schoolId = requireSchool(session)
    await deleteAllStudents(schoolId)

    return NextResponse.json({ success: true, message: 'All students deleted successfully' })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/students/bulk')
  }
}
