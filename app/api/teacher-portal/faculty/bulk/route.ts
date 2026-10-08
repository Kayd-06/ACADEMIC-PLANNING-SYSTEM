import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty, teacherBatches, batches, type NewFaculty } from '@/lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'
import { isValidPhone, PHONE_FORMAT_ERROR } from '@/lib/validation/phone'
import { isValidEmail, EMAIL_FORMAT_ERROR } from '@/lib/validation/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_SIZE = 100
const CONCURRENCY = 3

interface FieldError {
  row: string
  field: 'name' | 'subject' | 'specialization' | 'batches' | 'phone' | 'altPhone' | 'email' | 'general'
  value: string
  message: string
}

class ValidationError extends Error {
  field: 'name' | 'subject' | 'specialization' | 'phone' | 'altPhone' | 'email'
  value: string
  constructor(field: 'name' | 'subject' | 'specialization' | 'phone' | 'altPhone' | 'email', value: string, message: string) {
    super(message)
    this.field = field
    this.value = value
  }
}

// Every faculty field the manual "Add Faculty" form and CSV template support,
// excluding name/subject/specialization (required, handled separately) and
// batches (a comma-separated names cell here, not the legacy count column).
const FACULTY_ROW_FIELDS = [
  'employeeId', 'email', 'phone', 'altPhone', 'dob', 'gender',
  'addressLine1', 'city', 'state', 'pincode',
  'qualification', 'joiningDate', 'bio', 'profileImgUrl',
] as const

// Columns a re-import may change on an existing teacher.
const EDITABLE = ['name', 'subject', 'specialization', ...FACULTY_ROW_FIELDS, 'status', 'isActive', 'experienceYears', 'experience'] as const
const COLUMN: Record<string, string> = {
  name: 'name', subject: 'subject', specialization: 'specialization', employeeId: 'employee_id', email: 'email',
  phone: 'phone', altPhone: 'alt_phone', dob: 'dob', gender: 'gender', addressLine1: 'address_line1', city: 'city',
  state: 'state', pincode: 'pincode', qualification: 'qualification', joiningDate: 'joining_date', bio: 'bio',
  profileImgUrl: 'profile_img_url', status: 'status', isActive: 'is_active', experienceYears: 'experience_years',
  experience: 'experience',
}
function upsertSet() {
  const set: Record<string, any> = { updatedAt: sql`now()` }
  for (const f of EDITABLE) set[f] = sql.raw(`excluded.${COLUMN[f]}`)
  return set
}
// Predicate of faculty_employee_id_school_unique.
const EMPLOYEE_KEY_PREDICATE = sql`"employee_id" IS NOT NULL AND "employee_id" <> ''`

interface PlannedFaculty {
  indexes: number[]           // every file row folded into this teacher
  value: NewFaculty & { id: string }
  keyed: boolean              // new teacher with an Employee ID -> upsert on (employee_id, school_id)
  batchNames: Map<string, string> // lower -> canonical batch name
  subject: string
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can import faculty' }, { status: 403 })
    }

    const body = await req.json()
    const { faculty: rows } = body as { faculty: any[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No faculty data provided' }, { status: 400 })
    }
    // Never "no school = all schools": rows are always created in, and matched
    // against, the session's school.
    const schoolId = requireSchool(session)

    // One query each for the school's batches and teachers (previously 3–6
    // queries per row with every row in flight at once).
    const [schoolBatches, schoolFaculty] = await Promise.all([
      db.select().from(batches).where(eq(batches.schoolId, schoolId)),
      db.select().from(faculty).where(eq(faculty.schoolId, schoolId)),
    ])
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))
    const byEmployeeId = new Map<string, (typeof schoolFaculty)[number]>()
    const byEmail = new Map<string, (typeof schoolFaculty)[number]>()
    for (const f of schoolFaculty) {
      if (f.employeeId && !byEmployeeId.has(f.employeeId)) byEmployeeId.set(f.employeeId, f)
      if (f.email && !byEmail.has(f.email)) byEmail.set(f.email, f)
    }

    const rowLabels = rows.map((r: any, i: number) => r.name?.trim() || `Row ${i + 1}`)
    const errors: Array<FieldError & { index: number }> = []
    const plannedByKey = new Map<string, PlannedFaculty>()
    const planned: PlannedFaculty[] = []

    rows.forEach((r: any, i: number) => {
      try {
        const name = r.name?.trim() || ''
        const subject = r.subject?.trim() || ''
        const specialization = r.specialization?.trim() || ''
        if (!name) throw new ValidationError('name', '', 'Name is required')
        if (!subject) throw new ValidationError('subject', '', 'Subject is required')
        if (!specialization) throw new ValidationError('specialization', '', 'Specialization is required')
        if (r.phone && !isValidPhone(String(r.phone))) throw new ValidationError('phone', String(r.phone), PHONE_FORMAT_ERROR)
        if (r.altPhone && !isValidPhone(String(r.altPhone))) throw new ValidationError('altPhone', String(r.altPhone), 'Alt phone number must be 10 digits')
        if (r.email && !isValidEmail(String(r.email))) throw new ValidationError('email', String(r.email), EMAIL_FORMAT_ERROR)

        const employeeId = r.employeeId?.trim() || ''
        const email = r.email?.trim() || ''

        // Batch validation is non-blocking: bad names are reported but the
        // row (and any valid batch names in the same cell) still saves.
        const requestedBatchNames = (r.batches?.trim() || '')
          .split(',')
          .map((b: string) => b.trim())
          .filter(Boolean)
        const validBatches = new Map<string, string>()
        const invalidBatchNames: string[] = []
        for (const bn of requestedBatchNames) {
          const match = batchByName.get(bn.toLowerCase())
          if (match) validBatches.set(match.name.trim().toLowerCase(), match.name)
          else invalidBatchNames.push(bn)
        }
        if (invalidBatchNames.length > 0) {
          errors.push({
            index: i,
            row: rowLabels[i],
            field: 'batches',
            value: invalidBatchNames.join(', '),
            message: `Batch(es) not found: ${invalidBatchNames.join(', ')}. Create them first in Academic Planning, or fix the spelling.`,
          })
        }

        const data: Record<string, any> = { name, subject, specialization }
        for (const f of FACULTY_ROW_FIELDS) {
          const v = r[f]
          if (typeof v === 'string' && v.trim()) data[f] = v.trim()
        }
        const statusValue = r.status?.trim() || ''
        if (statusValue) {
          data.status = statusValue.toUpperCase()
          data.isActive = statusValue.toUpperCase() !== 'INACTIVE'
        }
        const experienceYearsValue = r.experienceYears?.trim() || ''
        if (experienceYearsValue) {
          data.experienceYears = Number(experienceYearsValue) || null
          data.experience = `${data.experienceYears} years`
        }

        // Match on the most reliable key available: Employee ID, then Email.
        // Neither present -> always a new teacher.
        const existing = employeeId ? byEmployeeId.get(employeeId) : email ? byEmail.get(email) : undefined
        const key = existing ? `id:${existing.id}` : employeeId ? `emp:${employeeId}` : email ? `email:${email}` : null

        // Same teacher twice in this file: fold the later row into the
        // earlier one (later values win, batch names are combined).
        const earlier = key ? plannedByKey.get(key) : undefined
        if (earlier) {
          Object.assign(earlier.value, data)
          earlier.indexes.push(i)
          validBatches.forEach((v, k) => earlier.batchNames.set(k, v))
          earlier.subject = subject
          return
        }

        // Absent optional cells never blank out stored values: start from the
        // stored row and apply only what the sheet provides.
        const base: Record<string, any> = existing
          ? Object.fromEntries(EDITABLE.map(f => [f, (existing as any)[f]]))
          : {}
        const value = {
          ...base,
          ...data,
          id: existing?.id ?? crypto.randomUUID(),
          schoolId,
          employeeId: employeeId || existing?.employeeId || null,
        } as NewFaculty & { id: string }
        const plan: PlannedFaculty = { indexes: [i], value, keyed: !existing && !!employeeId, batchNames: validBatches, subject }
        if (key) plannedByKey.set(key, plan)
        planned.push(plan)
      } catch (reason) {
        if (reason instanceof ValidationError) {
          errors.push({ index: i, row: rowLabels[i], field: reason.field, value: reason.value, message: reason.message })
        } else {
          console.error('[faculty bulk import] row parse failed', reason)
          errors.push({ index: i, row: rowLabels[i], field: 'general', value: '', message: 'Invalid row' })
        }
      }
    })

    const parts = chunk(planned, CHUNK_SIZE)
    const results = await mapWithConcurrency(parts, CONCURRENCY, (part) => writeChunk(part, schoolId))
    let succeeded = 0
    let failed = errors.filter(e => e.field !== 'batches').length
    results.forEach((result, ci) => {
      if (result.status === 'fulfilled') {
        succeeded += result.value
        return
      }
      console.error('[faculty bulk import] chunk failed', result.reason)
      for (const p of parts[ci]) for (const index of p.indexes) {
        failed++
        errors.push({ index, row: rowLabels[index], field: 'general', value: '', message: 'Could not be saved (it may conflict with another teacher). Please check the row and try again.' })
      }
    })

    errors.sort((a, b) => a.index - b.index)
    const publicErrors: FieldError[] = errors.map(({ index: _i, ...e }) => e)
    if (failed > 0) console.error('Faculty bulk import failures:', failed)

    return NextResponse.json({ succeeded, failed, total: rows.length, errors: publicErrors }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/teacher-portal/faculty/bulk')
  }
}

/** Upsert one chunk of teachers + their batch assignments. Returns the number of file rows saved. */
async function writeChunk(part: PlannedFaculty[], schoolId: string): Promise<number> {
  const byId = part.filter(p => !p.keyed)
  const keyed = part.filter(p => p.keyed)
  const statements: any[] = []
  if (byId.length > 0) {
    statements.push(
      db.insert(faculty).values(byId.map(p => p.value))
        .onConflictDoUpdate({ target: faculty.id, set: upsertSet(), setWhere: sql`"faculty"."school_id" = excluded.school_id` })
        .returning({ id: faculty.id, employeeId: faculty.employeeId }),
    )
  }
  if (keyed.length > 0) {
    statements.push(
      db.insert(faculty).values(keyed.map(p => p.value))
        .onConflictDoUpdate({ target: [faculty.employeeId, faculty.schoolId], targetWhere: EMPLOYEE_KEY_PREDICATE, set: upsertSet() })
        .returning({ id: faculty.id, employeeId: faculty.employeeId }),
    )
  }
  const results: Array<Array<{ id: string; employeeId: string | null }>> = await db.batch(statements as [any, ...any[]])
  const ids = new Set<string>()
  const idByEmployee = new Map<string, string>()
  for (const rows of results) for (const r of rows) {
    ids.add(r.id)
    if (r.employeeId) idByEmployee.set(r.employeeId, r.id)
  }
  const teacherIdOf = (p: PlannedFaculty) =>
    p.keyed ? idByEmployee.get(p.value.employeeId as string) : (ids.has(p.value.id) ? p.value.id : undefined)

  const saved = part.map(p => ({ p, teacherId: teacherIdOf(p) })).filter((x): x is { p: PlannedFaculty; teacherId: string } => !!x.teacherId)
  const teacherIds = saved.map(x => x.teacherId)

  if (teacherIds.length > 0) {
    // Add-only batch assignment: never remove an assignment this sheet
    // doesn't mention, never duplicate one it does.
    const existingAssignments = await db.select({ teacherId: teacherBatches.teacherId, batchName: teacherBatches.batchName })
      .from(teacherBatches).where(inArray(teacherBatches.teacherId, teacherIds))
    const have = new Set(existingAssignments.map(a => `${a.teacherId}|${a.batchName.trim().toLowerCase()}`))
    const today = new Date().toISOString().split('T')[0]
    const newAssignments: Array<typeof teacherBatches.$inferInsert> = []
    for (const { p, teacherId } of saved) {
      p.batchNames.forEach((name, lower) => {
        if (have.has(`${teacherId}|${lower}`)) return
        have.add(`${teacherId}|${lower}`)
        newAssignments.push({ teacherId, batchName: name, subjectName: p.subject, role: 'primary', assignedAt: today })
      })
    }
    // Legacy count column reflects the real total, recomputed in SQL in the
    // same transaction as the new assignments.
    const writes: any[] = []
    if (newAssignments.length > 0) writes.push(db.insert(teacherBatches).values(newAssignments))
    writes.push(
      db.update(faculty)
        .set({ batches: sql`(select count(*)::int from "teacher_batches" tb where tb.teacher_id = "faculty"."id")` })
        .where(inArray(faculty.id, teacherIds)),
    )
    await db.batch(writes as [any, ...any[]])
  }

  return saved.reduce((n, x) => n + x.p.indexes.length, 0)
}
