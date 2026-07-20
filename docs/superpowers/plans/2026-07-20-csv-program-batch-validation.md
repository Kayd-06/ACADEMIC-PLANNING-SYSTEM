# CSV Program/Batch Validation & Section Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV student imports reject rows whose Program/Batch values don't match real, school-scoped records (with a clear per-field error), and "Section" is removed from the Student Roster filter and the CSV upload modal.

**Architecture:** `POST /api/students/bulk` builds school-scoped Program/Batch name lookup maps once per request, validates each row before upserting, and returns structured per-row field errors instead of a generic string list. `CsvUploadModal.tsx` runs the same check locally (using Program/Batch lists it already fetches) to highlight bad cells in the preview before the admin even clicks Import, and renders the server's detailed errors after import. Section stays a real column/match-key on the backend — only its UI surface (Roster filter, CSV template, upload modal) is removed.

**Tech Stack:** Next.js App Router API routes, Drizzle ORM (`drizzle-orm/neon-http`) on Neon Postgres, Jest for route tests, React (client components) for the modal/roster UI.

## Global Constraints

- Empty Program/Batch values remain allowed (unassigned) — validation only triggers when a non-empty value is present, from either the CSV cell or a default.
- Program match is case-insensitive exact match against `Program.name`, scoped to the session's `schoolId` (matching the existing `schoolId ? filter : return all` pattern used in `app/api/programs/route.ts` and `app/api/batches/route.ts` — not `isNull`).
- Batch match is case-insensitive exact match against `Batch.name`, same scoping rule, plus: if both Program and Batch are given, `Batch.programId` must equal the matched Program's `id`.
- A row that fails validation is skipped (not imported) — the rest of the request's valid rows still import (partial import, confirmed with user).
- Server response shape changes from `{ succeeded, failed, total, failedReasons: string[] }` to `{ succeeded, failed, total, errors: FieldError[] }` where `FieldError = { row: string; field: 'program' | 'batch' | 'general'; value: string; message: string }`.
- `row` in a `FieldError` is the student's trimmed name, plus `" (Roll <rollNo>)"` if a roll number is present.
- Section removal is UI/CSV-surface only: no schema change, no change to `students.section`'s unique index, no change to `upsertStudentByNameClassSection`. The CSV parser keeps reading a `Section` column if one is present (backward compat for old CSVs); only the template, the modal's "Default Section" picker, and the Roster's Section filter are removed.
- No auto-creation of Program/Batch records from CSV values — an unmatched value is always an error, never an implicit create.

---

### Task 1: Server-side Program/Batch validation with structured field errors

**Files:**
- Modify: `app/api/students/bulk/route.ts`
- Test: `app/api/students/bulk/route.test.ts`

**Interfaces:**
- Consumes: `programs`, `batches` tables from `@/lib/db/schema` (existing — `Program.name`, `Program.id`, `Program.schoolId`, `Batch.name`, `Batch.id`, `Batch.programId`, `Batch.schoolId`).
- Produces: `POST /api/students/bulk` response shape `{ succeeded: number; failed: number; total: number; errors: FieldError[] }` — Task 2 (client) consumes this exact shape.

- [ ] **Step 1: Read the current file so edits below apply against real content**

Run: read `app/api/students/bulk/route.ts` in your editor. The `POST` handler currently: filters rows needing a name, runs a `Promise.allSettled` over per-row upserts, and returns `{ succeeded, failed, total, failedReasons }`. You are replacing the whole `POST` function body and the top-of-file imports/interfaces.

- [ ] **Step 2: Replace the file's imports, interfaces, and helper with validation-aware versions**

Replace the top of the file (from `import { NextRequest...` through the `STUDENT_ROW_FIELDS` constant) with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { parentsGuardians, programs, batches } from '@/lib/db/schema'
import {
  upsertStudentByRollClassSection,
  upsertStudentByAdmissionNumber,
  upsertStudentByNameClassSection,
  createStudent,
  deleteAllStudents,
} from '@/lib/db/queries/students'
import type { NewStudent, Student } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

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

class ValidationError extends Error {
  field: 'program' | 'batch'
  value: string
  constructor(field: 'program' | 'batch', value: string, message: string) {
    super(message)
    this.field = field
    this.value = value
  }
}

function resolveField(rowValue: string, defaultValue?: string): string {
  return defaultValue?.trim() ? defaultValue.trim() : rowValue
}

// Every student field the "Add Student" form and CSV template support
const STUDENT_ROW_FIELDS = [
  'admissionNumber', 'aadharNumber',
  'email', 'phone', 'addressLine1', 'city', 'state', 'pincode',
  'dob', 'gender', 'bloodGroup', 'profileImgUrl',
  'previousSchool', 'previousPercentage', 'admissionDate', 'notes',
] as const
```

- [ ] **Step 3: Replace the `POST` handler with the validating version**

Replace the entire `export async function POST(req: NextRequest) { ... }` block with:

```ts
// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const body = await req.json()
    const { students, defaults } = body as { students: any[]; defaults?: BulkDefaults }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Only name is required; all other fields are optional
    const valid = students.filter((s: any) => s.name?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }

    // Program/Batch must match a real, school-scoped record — CSV values and
    // modal defaults are free text with no other guarantee of correctness.
    const schoolPrograms = schoolId
      ? await db.select().from(programs).where(eq(programs.schoolId, schoolId))
      : await db.select().from(programs)
    const schoolBatches = schoolId
      ? await db.select().from(batches).where(eq(batches.schoolId, schoolId))
      : await db.select().from(batches)
    const programByName = new Map(schoolPrograms.map((p) => [p.name.trim().toLowerCase(), p]))
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))

    const rowLabels = valid.map((s: any) => {
      const name = s.name.trim()
      const rollNo = s.rollNo?.trim()
      return rollNo ? `${name} (Roll ${rollNo})` : name
    })

    const results = await Promise.allSettled(
      valid.map(async (s: any) => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = resolveField(s.section?.trim() || '', defaults?.section)
        const program = resolveField(s.program?.trim() || '', defaults?.program)
        const batch = resolveField(s.batch?.trim() || '', defaults?.batch)
        const parentContact = s.parentContact?.trim() || ''
        const status = s.status?.trim() || 'active'

        let matchedProgram: typeof schoolPrograms[number] | undefined
        if (program) {
          matchedProgram = programByName.get(program.toLowerCase())
          if (!matchedProgram) {
            throw new ValidationError('program', program, `Program "${program}" does not exist. Create it first in Academic Planning, or fix the spelling.`)
          }
        }
        if (batch) {
          const matchedBatch = batchByName.get(batch.toLowerCase())
          if (!matchedBatch) {
            throw new ValidationError('batch', batch, `Batch "${batch}" does not exist. Create it first in Academic Planning, or fix the spelling.`)
          }
          if (matchedProgram && matchedBatch.programId !== matchedProgram.id) {
            throw new ValidationError('batch', batch, `Batch "${batch}" exists but belongs to a different Program, not "${program}".`)
          }
        }

        const data: NewStudent = {
          name, rollNo, class: cls, section, program, batch, parentContact,
          status, isActive: status.toLowerCase() !== 'inactive',
          schoolId,
        }
        for (const f of STUDENT_ROW_FIELDS) {
          const v = s[f]
          if (typeof v === 'string' && v.trim()) data[f] = v.trim()
        }

        // Match on the most reliable key available, falling back progressively:
        // rollNo+class+section, then admission number, then name+class+section,
        // then a plain insert (name-only rows are always added fresh).
        let student: Student
        if (rollNo && cls && section) {
          student = await upsertStudentByRollClassSection(data)
        } else if (data.admissionNumber) {
          student = await upsertStudentByAdmissionNumber(data)
        } else if (cls && section) {
          student = await upsertStudentByNameClassSection(data)
        } else {
          student = await createStudent(data)
        }

        const guardianName = s.guardianName?.trim()
        if (guardianName) {
          const guardianData = {
            name: guardianName,
            relationship: s.guardianRelationship?.trim() || 'Parent',
            phone: s.guardianPhone?.trim() || undefined,
            email: s.guardianEmail?.trim() || undefined,
          }
          const [existingPrimary] = await db.select({ id: parentsGuardians.id })
            .from(parentsGuardians)
            .where(and(eq(parentsGuardians.studentId, student.id), eq(parentsGuardians.isPrimary, true)))
          if (existingPrimary) {
            await db.update(parentsGuardians)
              .set({ ...guardianData, updatedAt: new Date() })
              .where(eq(parentsGuardians.id, existingPrimary.id))
          } else {
            await db.insert(parentsGuardians).values({ ...guardianData, studentId: student.id, isPrimary: true })
          }
        }

        return student
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const errors: FieldError[] = []
    results.forEach((r, i) => {
      if (r.status !== 'rejected') return
      const reason = r.reason
      if (reason instanceof ValidationError) {
        errors.push({ row: rowLabels[i], field: reason.field, value: reason.value, message: reason.message })
      } else {
        errors.push({ row: rowLabels[i], field: 'general', value: '', message: reason?.message || String(reason) })
      }
    })
    const failed = errors.length

    if (failed > 0) {
      console.error('Bulk import failures:', errors)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, errors }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Leave the `DELETE` handler below it untouched.

- [ ] **Step 4: Update existing tests that used fake Program/Batch names**

`app/api/students/bulk/route.test.ts` has three tests that will now fail because they use Program/Batch names that don't correspond to real records. Open the file and apply these changes:

Change the response-shape assertion in `'inserts name-only rows as plain creates'`:

```ts
    expect(body).toEqual({ succeeded: 2, failed: 0, total: 2, errors: [] })
```

Replace `'uses the global default program/batch/section when provided, overriding row values'` with a version that seeds real Program/Batch records first:

```ts
  it('uses the global default program/batch/section when provided, overriding row values', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [program] = await db.insert(programs).values({ name: 'Default Program' }).returning()
    const [batch] = await db.insert(batches).values({ name: 'Default Batch', programId: program.id }).returning()
    try {
      const res = await POST(
        req({
          students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }],
          defaults: { program: 'Default Program', batch: 'Default Batch', section: 'Default Section' },
        })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.succeeded).toBe(1)

      const rows = await db.select().from(students)
      expect(rows[0].program).toBe('Default Program')
      expect(rows[0].batch).toBe('Default Batch')
      expect(rows[0].section).toBe('Default Section')
    } finally {
      await db.delete(batches).where(eq(batches.id, batch.id))
      await db.delete(programs).where(eq(programs.id, program.id))
    }
  })
```

Replace `'falls back to the row CSV value when no default is provided'` the same way:

```ts
  it('falls back to the row CSV value when no default is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [program] = await db.insert(programs).values({ name: 'Row Program' }).returning()
    const [batch] = await db.insert(batches).values({ name: 'Row Batch', programId: program.id }).returning()
    try {
      const res = await POST(
        req({ students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }] })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.succeeded).toBe(1)

      const rows = await db.select().from(students)
      expect(rows[0].program).toBe('Row Program')
      expect(rows[0].batch).toBe('Row Batch')
      expect(rows[0].section).toBe('Row Section')
    } finally {
      await db.delete(batches).where(eq(batches.id, batch.id))
      await db.delete(programs).where(eq(programs.id, program.id))
    }
  })
```

Update the top imports to include `programs`, `batches`, `schools`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, parentsGuardians, programs, batches, schools } from '@/lib/db/schema'
```

- [ ] **Step 5: Run the updated tests to confirm the existing suite still passes**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: all tests pass (the three updated tests now seed real Program/Batch records and pass; nothing else changed behavior).

- [ ] **Step 6: Add new tests for validation behavior**

Append these tests inside the `describe('POST /api/students/bulk', ...)` block, after `'leaves program and batch empty when neither a default nor a row value is provided'`:

```ts
  it('skips a row whose Program does not exist and reports a field error', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'Ghost Program', program: 'Nonexistent Program' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.succeeded).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors).toEqual([
      { row: 'Ghost Program', field: 'program', value: 'Nonexistent Program', message: expect.stringContaining('does not exist') },
    ])

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(0)
  })

  it('skips a row whose Batch does not exist and reports a field error', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'Ghost Batch', batch: 'Nonexistent Batch' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.succeeded).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors[0].field).toBe('batch')
    expect(body.errors[0].value).toBe('Nonexistent Batch')

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(0)
  })

  it('skips a row whose Batch belongs to a different Program than the one given', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [programA] = await db.insert(programs).values({ name: 'Program A' }).returning()
    const [programB] = await db.insert(programs).values({ name: 'Program B' }).returning()
    const [batchOfA] = await db.insert(batches).values({ name: 'Batch Of A', programId: programA.id }).returning()
    try {
      const res = await POST(req({ students: [{ name: 'Mismatch', program: 'Program B', batch: 'Batch Of A' }] }))
      const body = await res.json()
      expect(body.succeeded).toBe(0)
      expect(body.failed).toBe(1)
      expect(body.errors[0].field).toBe('batch')
      expect(body.errors[0].message).toContain('different Program')
    } finally {
      await db.delete(batches).where(eq(batches.id, batchOfA.id))
      await db.delete(programs).where(eq(programs.id, programA.id))
      await db.delete(programs).where(eq(programs.id, programB.id))
    }
  })

  it('imports valid rows and skips only the invalid ones in the same request', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({
      students: [
        { name: 'Valid Row' },
        { name: 'Invalid Row', program: 'Totally Made Up Program' },
      ],
    }))
    const body = await res.json()
    expect(body.succeeded).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.total).toBe(2)

    const rows = await db.select().from(students)
    expect(rows.map((r) => r.name)).toEqual(['Valid Row'])
  })

  it('scopes Program/Batch validation by schoolId', async () => {
    const schoolId = '11111111-1111-1111-1111-111111111111'
    const otherSchoolId = '22222222-2222-2222-2222-222222222222'
    await db.insert(schools).values({ id: schoolId as any })
    await db.insert(schools).values({ id: otherSchoolId as any })
    const [otherSchoolProgram] = await db.insert(programs).values({ name: 'Other School Program', schoolId: otherSchoolId as any }).returning()
    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId } })
      const res = await POST(req({ students: [{ name: 'Cross School', program: 'Other School Program' }] }))
      const body = await res.json()
      expect(body.succeeded).toBe(0)
      expect(body.failed).toBe(1)
      expect(body.errors[0].field).toBe('program')
    } finally {
      await db.delete(programs).where(eq(programs.id, otherSchoolProgram.id))
      await db.delete(schools).where(eq(schools.id, schoolId as any))
      await db.delete(schools).where(eq(schools.id, otherSchoolId as any))
    }
  })
```

- [ ] **Step 7: Run the full bulk route test suite**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: all tests pass, including the 5 new validation tests.

- [ ] **Step 8: Commit**

```bash
git add app/api/students/bulk/route.ts app/api/students/bulk/route.test.ts
git commit -m "feat: validate CSV Program/Batch against real records with field-level errors"
```

---

### Task 2: CsvUploadModal — Section removal, template fix, Program/Batch preview validation

**Files:**
- Modify: `components/dashboard/management/CsvUploadModal.tsx`

**Interfaces:**
- Consumes: `POST /api/students/bulk` response shape from Task 1 — `{ succeeded, failed, total, errors: FieldError[] }` where `FieldError = { row: string; field: string; value: string; message: string }`.
- Produces: no exported interface changes — `TEMPLATE_HEADERS` and `downloadTemplate` keep their existing export names, just with fewer/blanked columns.

- [ ] **Step 1: Remove "Section" from the CSV template headers**

In `TEMPLATE_HEADERS`, change:

```ts
  'Previous School', 'Previous Percentage', 'Class', 'Section', 'Program', 'Batch',
```

to:

```ts
  'Previous School', 'Previous Percentage', 'Class', 'Program', 'Batch',
```

- [ ] **Step 2: Fix the sample rows — drop the Section value, blank the fabricated Program/Batch values**

Replace the `data` array inside `downloadTemplate()`:

```ts
  const data = [
    TEMPLATE_HEADERS,
    [
      'Rahul Sharma', 'ADM-101', '1234-5678-9012', '101',
      'rahul.sharma@example.com', '9876500001', '9876543210', '12 MG Road', 'Ahmedabad', 'Gujarat', '380001',
      '2010-04-12', 'Male', 'B+', 'https://example.com/photos/rahul.jpg',
      'St. Xavier School', '82%', '9', '', '',
      '2025-06-01', 'active', 'Scores well in Physics',
      'Suresh Sharma', 'Father', '9876543210', 'suresh.sharma@example.com',
    ],
    [
      'Priya Patel', 'ADM-102', '2234-5678-9012', '102',
      'priya.patel@example.com', '9876500002', '9123456789', '45 Ring Road', 'Surat', 'Gujarat', '395001',
      '2010-09-03', 'Female', 'O+', '',
      'DPS Surat', '91%', '9', '', '',
      '2025-06-01', 'active', '',
      'Meena Patel', 'Mother', '9123456789', 'meena.patel@example.com',
    ],
    ['Amit Verma', '', '', '103', '', '', '', '', '', '', '', '', '', '', '', '', '', '9', '', '', '', 'active', '', '', '', '', ''],
  ]
```

(Column count drops from 28 to 27 per row to match the shortened `TEMPLATE_HEADERS`; Program/Batch are now blank in every example row so the template never fails its own new validation.)

- [ ] **Step 3: Remove `section` from the `Defaults` interface**

Change:

```ts
interface Defaults {
  program: string
  batch: string
  section: string
}
```

to:

```ts
interface Defaults {
  program: string
  batch: string
}
```

- [ ] **Step 4: Remove `section` from the defaults initial state**

Change:

```ts
  const [defaults, setDefaults] = useState<Defaults>({ program: defaultProgram ?? '', batch: defaultBatch ?? '', section: '' })
```

to:

```ts
  const [defaults, setDefaults] = useState<Defaults>({ program: defaultProgram ?? '', batch: defaultBatch ?? '' })
```

- [ ] **Step 5: Remove `sectionOptions` and `section` from `customField`**

Change:

```ts
  const sectionOptions = Array.from(new Set([
    'A', 'B', 'C', 'D',
    ...students.map(s => s.rawSection)
  ])).filter(Boolean)

  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean; section: boolean }>({
    program: !!defaultProgram && !programOptions.includes(defaultProgram),
    batch: !!defaultBatch && !batchOptions.includes(defaultBatch),
    section: false,
  })
```

to:

```ts
  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean }>({
    program: !!defaultProgram && !programOptions.includes(defaultProgram),
    batch: !!defaultBatch && !batchOptions.includes(defaultBatch),
  })
```

- [ ] **Step 6: Extend `result` state and add the local Program/Batch preview check**

Change:

```ts
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)
```

to:

```ts
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    succeeded: number
    failed: number
    total: number
    errors: { row: string; field: string; value: string; message: string }[]
  } | null>(null)

  // Local preview check against the Program/Batch lists already fetched above —
  // lets the admin see a bad value before the round trip to the server, which
  // re-validates authoritatively regardless of what this check finds.
  const programNameSet = new Set(realPrograms.map((p) => String(p.name).trim().toLowerCase()))
  const batchByNameLower = new Map(realBatches.map((b) => [String(b.name).trim().toLowerCase(), b]))
  const programByNameLower = new Map(realPrograms.map((p) => [String(p.name).trim().toLowerCase(), p]))

  function rowValidation(row: ParsedRow): { program?: string; batch?: string } {
    const program = resolveField(row.program, defaults.program)
    const batch = resolveField(row.batch, defaults.batch)
    const errors: { program?: string; batch?: string } = {}
    if (program && !programNameSet.has(program.toLowerCase())) {
      errors.program = `"${program}" doesn't exist — create it in Academic Planning first.`
    }
    if (batch) {
      const matchedBatch = batchByNameLower.get(batch.toLowerCase())
      if (!matchedBatch) {
        errors.batch = `"${batch}" doesn't exist — create it in Academic Planning first.`
      } else if (program) {
        const matchedProgram = programByNameLower.get(program.toLowerCase())
        if (matchedProgram && matchedBatch.programId !== matchedProgram.id) {
          errors.batch = `"${batch}" belongs to a different Program.`
        }
      }
    }
    return errors
  }

  const rowsWithErrors = parsedRows.filter((r) => {
    const v = rowValidation(r)
    return !!(v.program || v.batch)
  }).length
```

- [ ] **Step 7: Remove the "Default Section" picker from the defaults grid**

Change:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {renderDefaultSelect('program', 'Default Program', programOptions)}
          {renderDefaultSelect('batch', 'Default Batch', batchOptions)}
          {renderDefaultSelect('section', 'Default Section', sectionOptions)}
        </div>
```

to:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderDefaultSelect('program', 'Default Program', programOptions)}
          {renderDefaultSelect('batch', 'Default Batch', batchOptions)}
        </div>
```

- [ ] **Step 8: Show detailed per-row errors in the post-import result panel**

Change:

```tsx
        {result && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
          </div>
        )}
```

to:

```tsx
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
            </div>
            {result.errors.length > 0 && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}><span className="font-bold">{e.row}:</span> {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 9: Remove the Section column from the preview table and highlight invalid Program/Batch cells**

Change:

```tsx
        {parsedRows.length > 0 && (
          <div className="mt-4 space-y-3.5">
            <p className="text-xs font-bold text-slate-800">Preview — {parsedRows.length} rows (after defaults applied)</p>
            <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner bg-slate-50/30">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-150">
                  <tr>
                    {['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Contact', 'Guardian'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 bg-white">
                      <td className="px-3.5 py-2 font-bold text-slate-800">{r.name}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-500">{r.rollNo || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-500">{r.class || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-500">{resolveField(r.section, defaults.section) || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-500">{resolveField(r.program, defaults.program) || '—'}</td>
                      <td className="px-3.5 py-2 font-semibold text-slate-500">{resolveField(r.batch, defaults.batch) || '—'}</td>
                      <td className="px-3.5 py-2 text-slate-450">{r.parentContact || r.phone || '—'}</td>
                      <td className="px-3.5 py-2 text-slate-450">{r.guardianName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer transform active:scale-[0.98]"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.length} Students`}
            </button>
          </div>
        )}
```

to:

```tsx
        {parsedRows.length > 0 && (
          <div className="mt-4 space-y-3.5">
            <p className="text-xs font-bold text-slate-800">Preview — {parsedRows.length} rows (after defaults applied)</p>
            {rowsWithErrors > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                {rowsWithErrors} row{rowsWithErrors === 1 ? '' : 's'} have a Program/Batch problem — see highlighted cells below. These rows will be skipped on import.
              </div>
            )}
            <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner bg-slate-50/30">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-150">
                  <tr>
                    {['Name', 'Roll No', 'Class', 'Program', 'Batch', 'Contact', 'Guardian'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => {
                    const rowErrors = rowValidation(r)
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 bg-white">
                        <td className="px-3.5 py-2 font-bold text-slate-800">{r.name}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.rollNo || '—'}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.class || '—'}</td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.program ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.program}>
                          {resolveField(r.program, defaults.program) || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.batch ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.batch}>
                          {resolveField(r.batch, defaults.batch) || '—'}
                        </td>
                        <td className="px-3.5 py-2 text-slate-450">{r.parentContact || r.phone || '—'}</td>
                        <td className="px-3.5 py-2 text-slate-450">{r.guardianName || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer transform active:scale-[0.98]"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.length} Students`}
            </button>
          </div>
        )}
```

Note: `ParsedRow.section`, the `get(['section', 'div', 'division'])` parser line, and `interface ParsedRow { ... section: string ... }` are **not** touched — they stay so old CSVs with a Section column still parse correctly and the value still flows to the server (which still accepts it for the match-key fallback).

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `CsvUploadModal.tsx` (pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern).

- [ ] **Step 11: Manual verification in the browser**

Run: `npm run dev`, sign in as a management user, open Student Roster → Upload CSV.
Verify:
- The defaults grid shows only "Default Program" and "Default Batch" (no "Default Section").
- Downloading the sample CSV opens a file whose header row has no "Section" column and whose Program/Batch cells are blank in the example rows.
- Uploading a CSV with a Program value that doesn't match any real Program shows that cell highlighted red in the preview, and the amber "N rows have a Program/Batch problem" banner appears.
- Clicking Import still imports the valid rows and shows the skipped row's error message (from the server) in the post-import panel.

- [ ] **Step 12: Commit**

```bash
git add components/dashboard/management/CsvUploadModal.tsx
git commit -m "feat: preview-validate CSV Program/Batch and drop Section from the upload modal"
```

---

### Task 3: Student Roster — remove the Section filter

**Files:**
- Modify: `components/dashboard/management/StudentRosterView.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: nothing consumed by other tasks — this is a self-contained UI removal.

- [ ] **Step 1: Remove the `sectionFilter` state**

Change:

```ts
  const [classFilter, setClassFilter] = useState('All Classes')
  const [sectionFilter, setSectionFilter] = useState('All Sections')
  const [batchFilter, setBatchFilter] = useState('All Batches')
```

to:

```ts
  const [classFilter, setClassFilter] = useState('All Classes')
  const [batchFilter, setBatchFilter] = useState('All Batches')
```

- [ ] **Step 2: Remove the `sections` derived list and the Section clause in `filteredStudents`**

Change:

```ts
  const classes = ['All Classes', ...Array.from(new Set(students.map(s => s.rawClass).filter(Boolean)))]
  const sections = ['All Sections', ...Array.from(new Set(students.map(s => s.rawSection).filter(Boolean)))]
  const batches = ['All Batches', ...Array.from(new Set([
    ...students.map(s => s.batch).filter(Boolean),
    // Keep the sidebar-selected batch present even if it has no students yet
    ...(batchFilter !== 'All Batches' ? [batchFilter] : []),
  ]))]

  // Filter students. Program filtering matches each student's own `program`
  // field — a batch can be linked to several programs, so filtering by batch
  // alone would show students who were never enrolled in the selected program.
  const filteredStudents = students.filter(s => {
    if (classFilter !== 'All Classes' && s.rawClass !== classFilter) return false
    if (sectionFilter !== 'All Sections' && s.rawSection !== sectionFilter) return false
    if (batchFilter !== 'All Batches' && s.batch !== batchFilter) return false
    if (selectedProgramName && s.program !== selectedProgramName) return false
    return true
```

to:

```ts
  const classes = ['All Classes', ...Array.from(new Set(students.map(s => s.rawClass).filter(Boolean)))]
  const batches = ['All Batches', ...Array.from(new Set([
    ...students.map(s => s.batch).filter(Boolean),
    // Keep the sidebar-selected batch present even if it has no students yet
    ...(batchFilter !== 'All Batches' ? [batchFilter] : []),
  ]))]

  // Filter students. Program filtering matches each student's own `program`
  // field — a batch can be linked to several programs, so filtering by batch
  // alone would show students who were never enrolled in the selected program.
  const filteredStudents = students.filter(s => {
    if (classFilter !== 'All Classes' && s.rawClass !== classFilter) return false
    if (batchFilter !== 'All Batches' && s.batch !== batchFilter) return false
    if (selectedProgramName && s.program !== selectedProgramName) return false
    return true
```

- [ ] **Step 3: Remove the Section `<select>` block from the filter row**

Change:

```tsx
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Section</label>
            <select 
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none appearance-none cursor-pointer"
            >
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Batch</label>
```

to:

```tsx
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Batch</label>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `StudentRosterView.tsx`.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, sign in as a management user, open Student Roster.
Verify: the filter row shows only Class and Batch (no Section dropdown), and filtering by Class/Batch still works. The Class and Batch dropdowns each take up roughly half the row width, no leftover empty space.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/management/StudentRosterView.tsx
git commit -m "feat: remove the Section filter from the Student Roster"
```
