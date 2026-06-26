# Student Roster Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree note:** this plan continues in the existing worktree at `E:\Academic_planning_system\.claude\worktrees\student-roster-postgres-migration` (branch `worktree-student-roster-postgres-migration`) — do NOT create a new worktree. This feature builds directly on that branch's already-migrated `students` Postgres table and routes, which don't exist on `main` yet.

**Goal:** Let management add, edit, and (soft-)delete students, and bulk-import a roster from CSV/Excel with Program/Batch/Section support, on the `/management/students` page.

**Architecture:** Add `program`/`batch` as two new free-text columns on the existing `students` Postgres table (same style as `class`/`section`). Extend the three existing student API routes (`/api/students`, `/api/students/bulk`, `/api/students/roster`) to read/write the new fields. Build two new client components (`StudentFormModal` for add/edit, `CsvUploadModal` for bulk import) and wire them into the existing `StudentRosterView.tsx`, replacing its placeholder "Edit Profile" toast and adding row-level actions.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Neon Postgres), Jest, `xlsx` (already a dependency) for client-side CSV/Excel parsing.

## Global Constraints

- Every new/changed API behavior must use the soft-delete (`isActive: false`) path only — no UI exposes the existing `permanent=true` delete flag.
- `program`/`batch` are plain free-text `varchar` columns on `students`, not a foreign key to the separate Mongo `Program` model — they're independent of that model entirely.
- CSV bulk-import precedence: a non-empty global default (`program`/`batch`/`section`) always overrides that field's per-row CSV value; an empty/unset default falls back to the row's own CSV value; if both are empty, the field is stored as `''`.
- The edit form never exposes an `isActive` toggle — deactivation is owned exclusively by the Delete action.
- `GET /api/students/roster` must keep returning both active and inactive students (existing behavior) — the fix for newly-deleted students reappearing belongs in the frontend (`StudentRosterView.tsx` filters them out after fetching), not in the API.
- Run `npm test` and `npm run build` after every task; both must stay clean.
- Commit after every task.

---

### Task 1: Add `program`/`batch` columns to the students schema

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/queries/students.test.ts`
- Create: `lib/db/migrations/0002_*.sql` (name chosen by `drizzle-kit generate`)

**Interfaces:**
- Produces: `students.program` and `students.batch` columns (both `varchar(255)`, not null, default `''`), reflected automatically in the `Student`/`NewStudent` types every later task imports from `../schema`.

- [ ] **Step 1: Add the two columns**

In `lib/db/schema.ts`, find the `students` table definition and add `program`/`batch` right after `section` (before `parentContact`):

```ts
export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
    class: varchar('class', { length: 255 }).notNull().default(''),
    section: varchar('section', { length: 255 }).notNull().default(''),
    program: varchar('program', { length: 255 }).notNull().default(''),
    batch: varchar('batch', { length: 255 }).notNull().default(''),
    parentContact: varchar('parent_contact', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rollClassSectionUnique: uniqueIndex('students_roll_no_class_section_unique')
      .on(table.rollNo, table.class, table.section)
      .where(sql`${table.rollNo} <> '' AND ${table.class} <> '' AND ${table.section} <> ''`),
  })
)
```

(Only the `program`/`batch` lines are new — everything else in this table definition is unchanged.)

- [ ] **Step 2: Generate and apply the migration**

Run: `npm run db:generate`
Expected: a new file at `lib/db/migrations/0002_<name>.sql` containing `ALTER TABLE "students" ADD COLUMN "program" varchar(255) DEFAULT '' NOT NULL;` and the same for `batch`.

Run: `npm run db:migrate`
Expected: exits 0, reports the new migration applied.

- [ ] **Step 3: Write the failing test**

In `lib/db/queries/students.test.ts`, add this test inside the existing `describe('students queries', ...)` block, right after the `'createStudent inserts a row with defaults applied'` test:

```ts
  it('createStudent applies empty-string defaults to program and batch', async () => {
    const student = await createStudent({ name: 'No Program Set' })
    expect(student.program).toBe('')
    expect(student.batch).toBe('')
  })

  it('createStudent persists explicit program and batch values', async () => {
    const student = await createStudent({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning' })
    expect(student.program).toBe('JEE 2026')
    expect(student.batch).toBe('Morning')
  })
```

- [ ] **Step 4: Run the test**

Run: `npm test -- students.test.ts`
Expected: PASS (20 tests — 18 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/queries/students.test.ts lib/db/migrations
git commit -m "feat: add program and batch columns to students table"
```

---

### Task 2: Accept `program`/`batch` on `/api/students` create and update

**Files:**
- Modify: `app/api/students/route.ts`
- Modify: `app/api/students/route.test.ts`

**Interfaces:**
- Consumes: `students.program`/`students.batch` columns (Task 1).
- Produces: no new exports — `POST`/`PATCH` on this route now read/write `program`/`batch` like every other editable field.

- [ ] **Step 1: Write the failing tests**

In `app/api/students/route.test.ts`, add this test inside the `describe('POST /api/students', ...)` block, after the `'creates a student and returns it shaped with _id'` test:

```ts
  it('accepts and persists program and batch on create', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/students', {
        method: 'POST',
        body: JSON.stringify({ name: 'Prog Student', program: 'JEE 2026', batch: 'Morning' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.program).toBe('JEE 2026')
    expect(body.batch).toBe('Morning')
  })
```

Add this test inside the `describe('PATCH /api/students', ...)` block, after the `'updates a student by id'` test:

```ts
  it('updates program and batch', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'Before' }).returning()

    const res = await PATCH(
      req(`http://localhost/api/students?id=${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ program: 'Foundation', batch: 'Evening' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.program).toBe('Foundation')
    expect(body.batch).toBe('Evening')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/students/route.test.ts`
Expected: FAIL — `program`/`batch` are dropped by both handlers today.

- [ ] **Step 3: Update the route**

In `app/api/students/route.ts`, in the `POST` handler, change:

```ts
    const body = await req.json()
    const { name, rollNo, class: cls, section, parentContact } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    }

    const student = await createStudent({
      name: name.trim(),
      rollNo: rollNo?.trim() || '',
      class: cls?.trim() || '',
      section: section?.trim() || '',
      parentContact: parentContact?.trim() || '',
    })
```

to:

```ts
    const body = await req.json()
    const { name, rollNo, class: cls, section, program, batch, parentContact } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    }

    const student = await createStudent({
      name: name.trim(),
      rollNo: rollNo?.trim() || '',
      class: cls?.trim() || '',
      section: section?.trim() || '',
      program: program?.trim() || '',
      batch: batch?.trim() || '',
      parentContact: parentContact?.trim() || '',
    })
```

In the `PATCH` handler, change:

```ts
    const body = await req.json()
    const { name, rollNo, class: cls, section, parentContact, isActive } = body
    const updateData: Partial<NewStudent> = {}
    if (name !== undefined) updateData.name = name
    if (rollNo !== undefined) updateData.rollNo = rollNo
    if (cls !== undefined) updateData.class = cls
    if (section !== undefined) updateData.section = section
    if (parentContact !== undefined) updateData.parentContact = parentContact
    if (isActive !== undefined) updateData.isActive = isActive
```

to:

```ts
    const body = await req.json()
    const { name, rollNo, class: cls, section, program, batch, parentContact, isActive } = body
    const updateData: Partial<NewStudent> = {}
    if (name !== undefined) updateData.name = name
    if (rollNo !== undefined) updateData.rollNo = rollNo
    if (cls !== undefined) updateData.class = cls
    if (section !== undefined) updateData.section = section
    if (program !== undefined) updateData.program = program
    if (batch !== undefined) updateData.batch = batch
    if (parentContact !== undefined) updateData.parentContact = parentContact
    if (isActive !== undefined) updateData.isActive = isActive
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/students/route.test.ts`
Expected: PASS (12 tests — 10 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add app/api/students/route.ts app/api/students/route.test.ts
git commit -m "feat: accept program and batch fields on student create/update"
```

---

### Task 3: Bulk-import `defaults` precedence for program/batch/section

**Files:**
- Modify: `app/api/students/bulk/route.ts`
- Modify: `app/api/students/bulk/route.test.ts`

**Interfaces:**
- Consumes: `students.program`/`students.batch` columns (Task 1).
- Produces: `POST /api/students/bulk` now accepts an optional top-level `defaults: { program?: string; batch?: string; section?: string }` in its request body.

- [ ] **Step 1: Write the failing tests**

In `app/api/students/bulk/route.test.ts`, add these three tests inside the `describe('POST /api/students/bulk', ...)` block, after the `'skips rows with no name and reports the total of valid rows'` test:

```ts
  it('uses the global default program/batch/section when provided, overriding row values', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req({
        students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }],
        defaults: { program: 'Default Program', batch: 'Default Batch', section: 'Default Section' },
      })
    )
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('Default Program')
    expect(rows[0].batch).toBe('Default Batch')
    expect(rows[0].section).toBe('Default Section')
  })

  it('falls back to the row CSV value when no default is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req({ students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }] })
    )
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('Row Program')
    expect(rows[0].batch).toBe('Row Batch')
    expect(rows[0].section).toBe('Row Section')
  })

  it('leaves program and batch empty when neither a default nor a row value is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'A' }] }))
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('')
    expect(rows[0].batch).toBe('')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: FAIL — `program`/`batch`/`defaults` are not yet handled.

- [ ] **Step 3: Update the route**

Replace `app/api/students/bulk/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { upsertStudentByRollClassSection, createStudent, deleteAllStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

interface BulkDefaults {
  program?: string
  batch?: string
  section?: string
}

function resolveField(rowValue: string, defaultValue?: string): string {
  return defaultValue?.trim() ? defaultValue.trim() : rowValue
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
    const valid = students.filter((s: any) => s.name?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      valid.map((s: any) => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = resolveField(s.section?.trim() || '', defaults?.section)
        const program = resolveField(s.program?.trim() || '', defaults?.program)
        const batch = resolveField(s.batch?.trim() || '', defaults?.batch)
        const parentContact = s.parentContact?.trim() || ''

        // If rollNo + class + section all present → upsert (prevents duplicates)
        // Otherwise → plain insert (name-only rows are always added)
        if (rollNo && cls && section) {
          return upsertStudentByRollClassSection({ name, rollNo, class: cls, section, program, batch, parentContact, isActive: true })
        } else {
          return createStudent({ name, rollNo, class: cls, section, program, batch, parentContact, isActive: true })
        }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failedResults = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    const failed = failedResults.length
    const failedReasons = failedResults.map((r) => r.reason?.message || r.reason)

    if (failed > 0) {
      console.error('Bulk import failures:', failedReasons)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, failedReasons }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — bulk delete all students (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can clear all rosters' }, { status: 403 })
    }

    await deleteAllStudents()

    return NextResponse.json({ success: true, message: 'All students deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: PASS (10 tests — 7 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add app/api/students/bulk/route.ts app/api/students/bulk/route.test.ts
git commit -m "feat: support program/batch/section defaults in bulk student import"
```

---

### Task 4: Return real `program`/`batch` from `/api/students/roster`

**Files:**
- Modify: `app/api/students/roster/route.ts`
- Create: `app/api/students/roster/route.test.ts` (this route currently has no test file)

**Interfaces:**
- Consumes: `students.program`/`students.batch` columns (Task 1).
- Produces: every object in this route's JSON array response now has a real `program` field (in addition to the existing `batch` field, which stops being hardcoded).

- [ ] **Step 1: Write the failing test**

Create `app/api/students/roster/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/students/roster') as any
}

describe('GET /api/students/roster', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('returns real program and batch values when set', async () => {
    await db.insert(students).values({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning', class: '11 - A', section: 'A' })

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body[0].program).toBe('JEE 2026')
    expect(body[0].batch).toBe('Morning')
  })

  it('falls back to Unassigned when program and batch are empty', async () => {
    await db.insert(students).values({ name: 'No Program' })

    const res = await GET(req())
    const body = await res.json()

    expect(body[0].program).toBe('Unassigned')
    expect(body[0].batch).toBe('Unassigned')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/students/roster/route.test.ts`
Expected: FAIL — `program` is `undefined` in the response today, and `batch` is always the literal string `'Unassigned'` regardless of what's stored.

- [ ] **Step 3: Update the route**

In `app/api/students/roster/route.ts`, change the `roster` mapping's return object from:

```ts
      return {
        _id: s.id,
        roll: s.rollNo || 'N/A',
        name: s.name,
        class: `${s.class || 'N/A'} - ${s.section || 'N/A'}`,
        rawClass: s.class || '',
        rawSection: s.section || '',
        batch: 'Unassigned',
        batchTheme: 'blue', // defaults
        initials,
        color: colors[nameHash],
        contact: s.parentContact || 'N/A',
        isActive: s.isActive
      }
```

to:

```ts
      return {
        _id: s.id,
        roll: s.rollNo || 'N/A',
        name: s.name,
        class: `${s.class || 'N/A'} - ${s.section || 'N/A'}`,
        rawClass: s.class || '',
        rawSection: s.section || '',
        program: s.program || 'Unassigned',
        batch: s.batch || 'Unassigned',
        batchTheme: 'blue', // defaults
        initials,
        color: colors[nameHash],
        contact: s.parentContact || 'N/A',
        isActive: s.isActive
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/students/roster/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/students/roster/route.ts app/api/students/roster/route.test.ts
git commit -m "feat: return real program/batch values from students roster route"
```

---

### Task 5: Add-student modal and the isActive client-side filter fix

**Files:**
- Create: `components/dashboard/management/StudentFormModal.tsx`
- Modify: `components/dashboard/management/StudentRosterView.tsx`

**Interfaces:**
- Produces: `StudentFormModal` component, props `{ mode: 'add' | 'edit'; student?: any; onClose: () => void; onSaved: () => void }`. Task 6 reuses this same component in `'edit'` mode.
- No automated test for this task (no React component test infra in this project — verified via `npm run build` plus manual browser check, same as the rest of this plan's frontend work).

- [ ] **Step 1: Create the form modal component**

Create `components/dashboard/management/StudentFormModal.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface StudentFormValues {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  parentContact: string
}

const EMPTY_FORM: StudentFormValues = { name: '', rollNo: '', class: '', section: '', program: '', batch: '', parentContact: '' }

interface StudentFormModalProps {
  mode: 'add' | 'edit'
  student?: any
  onClose: () => void
  onSaved: () => void
}

function valuesFromStudent(student: any): StudentFormValues {
  return {
    name: student.name || '',
    rollNo: student.roll && student.roll !== 'N/A' ? student.roll : '',
    class: student.rawClass || '',
    section: student.rawSection || '',
    program: student.program && student.program !== 'Unassigned' ? student.program : '',
    batch: student.batch && student.batch !== 'Unassigned' ? student.batch : '',
    parentContact: student.contact && student.contact !== 'N/A' ? student.contact : '',
  }
}

export default function StudentFormModal({ mode, student, onClose, onSaved }: StudentFormModalProps) {
  const [form, setForm] = useState<StudentFormValues>(
    mode === 'edit' && student ? valuesFromStudent(student) : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Student name is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const url = mode === 'add' ? '/api/students' : `/api/students?id=${student._id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400'
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{mode === 'add' ? 'Add Student' : 'Edit Student'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div>
            <label className={labelClass}>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Roll No</label>
              <input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <input value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Section</label>
              <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Parent Contact</label>
              <input value={form.parentContact} onChange={(e) => setForm({ ...form, parentContact: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Program</label>
              <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Batch</label>
              <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'add' ? 'Add Student' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the Add Student button and fix the isActive client filter**

In `components/dashboard/management/StudentRosterView.tsx`, change the import line:

```tsx
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter } from 'lucide-react'
```

to:

```tsx
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus } from 'lucide-react'
import StudentFormModal from './StudentFormModal'
```

Change the `fetchStudents` function from:

```tsx
  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students/roster')
      if (res.ok) {
        const data = await res.json()
        setStudents(data)
      }
    } catch (error) {
      console.error('Failed to fetch students', error)
    } finally {
      setIsLoading(false)
    }
  }
```

to:

```tsx
  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students/roster')
      if (res.ok) {
        const data = await res.json()
        // /api/students/roster intentionally returns inactive students too;
        // filter them out here so a soft-deleted student doesn't reappear on refresh.
        setStudents(data.filter((s: any) => s.isActive !== false))
      }
    } catch (error) {
      console.error('Failed to fetch students', error)
    } finally {
      setIsLoading(false)
    }
  }
```

Add a new piece of state right after the existing `toastMessage` state:

```tsx
  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Add Student modal
  const [showAddModal, setShowAddModal] = useState(false)
```

Change the header block from:

```tsx
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Manage student records, batches, and parent/guardian details
            </p>
          </div>
          <button onClick={() => showToast('Syncing with SIS...')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Sync Data
          </button>
        </div>
```

to:

```tsx
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Roster</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Manage student records, batches, and parent/guardian details
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Student
            </button>
            <button onClick={() => showToast('Syncing with SIS...')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4" /> Sync Data
            </button>
          </div>
        </div>
```

Finally, render the modal right before the closing `</div>` at the very end of the component's returned JSX (after the `</AnimatePresence>` that closes the side drawer, still inside the outer `<div className="flex-1 overflow-hidden ...">`):

```tsx
      </AnimatePresence>

      {showAddModal && (
        <StudentFormModal mode="add" onClose={() => setShowAddModal(false)} onSaved={fetchStudents} />
      )}

    </div>
  )
}
```

- [ ] **Step 3: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/management/StudentFormModal.tsx components/dashboard/management/StudentRosterView.tsx
git commit -m "feat: add Add Student modal and fix inactive-student reappearance on refresh"
```

---

### Task 6: Row-level Edit/Delete actions, Program column, and drawer wiring

**Files:**
- Modify: `components/dashboard/management/StudentRosterView.tsx`

**Interfaces:**
- Consumes: `StudentFormModal` (Task 5), used here in `mode="edit"`.
- No automated test for this task — verified via `npm run build` plus manual browser check.

- [ ] **Step 1: Add the Pencil/Trash2 icons and an `editingStudent` state**

Change the import line from:

```tsx
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus } from 'lucide-react'
```

to:

```tsx
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus, Pencil, Trash2 } from 'lucide-react'
```

Add a new piece of state right after `showAddModal`:

```tsx
  // Add Student modal
  const [showAddModal, setShowAddModal] = useState(false)

  // Edit/Delete
  const [editingStudent, setEditingStudent] = useState<any>(null)
```

- [ ] **Step 2: Add the delete handler**

Add this function right after `showToast`:

```tsx
  const handleDelete = async (student: any) => {
    if (!confirm(`Remove ${student.name} from the active roster?`)) return
    try {
      const res = await fetch(`/api/students?id=${student._id}`, { method: 'DELETE' })
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s._id !== student._id))
        setSelectedStudent(null)
        showToast(`${student.name} removed from roster`)
      } else {
        showToast('Failed to remove student')
      }
    } catch {
      showToast('Failed to remove student')
    }
  }
```

- [ ] **Step 3: Add a Program column and row-level action icons to the table**

Change the table header from:

```tsx
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll No</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class & Sec</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                  </tr>
```

to:

```tsx
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Roll No</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class & Sec</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Program</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contact</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                  </tr>
```

Change the table row from:

```tsx
                      <td className="px-6 py-4 text-[13px] font-semibold text-slate-600">{student.roll}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${student.color}`}>
                            {student.initials}
                          </div>
                          <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.class}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          student.batchTheme === 'blue' ? 'bg-blue-50 text-blue-700' :
                          student.batchTheme === 'green' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {student.batch}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-600">{student.contact}</td>
                    </tr>
```

to:

```tsx
                      <td className="px-6 py-4 text-[13px] font-semibold text-slate-600">{student.roll}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${student.color}`}>
                            {student.initials}
                          </div>
                          <span className="text-[13px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.class}</td>
                      <td className="px-6 py-4 text-[13px] text-slate-700 font-medium">{student.program}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          student.batchTheme === 'blue' ? 'bg-blue-50 text-blue-700' :
                          student.batchTheme === 'green' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {student.batch}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-600">{student.contact}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingStudent(student) }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(student) }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
```

- [ ] **Step 4: Wire the drawer's Edit Profile button and add a Remove button**

Change the drawer footer from:

```tsx
              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-3">
                <button onClick={() => showToast('Opening edit modal...')} className="py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                  Edit Profile
                </button>
                <button onClick={() => showToast(`Drafting message to ${selectedStudent.contact}`)} className="py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Message Parent
                </button>
              </div>
```

to:

```tsx
              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-3 gap-3">
                <button onClick={() => setEditingStudent(selectedStudent)} className="py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                  Edit Profile
                </button>
                <button onClick={() => handleDelete(selectedStudent)} className="py-2.5 bg-white border border-rose-200 text-rose-600 text-sm font-bold rounded-lg hover:bg-rose-50 transition-colors shadow-sm">
                  Remove
                </button>
                <button onClick={() => showToast(`Drafting message to ${selectedStudent.contact}`)} className="py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
                  Message Parent
                </button>
              </div>
```

- [ ] **Step 5: Render the edit modal**

Change the closing block from:

```tsx
      {showAddModal && (
        <StudentFormModal mode="add" onClose={() => setShowAddModal(false)} onSaved={fetchStudents} />
      )}

    </div>
  )
}
```

to:

```tsx
      {showAddModal && (
        <StudentFormModal mode="add" onClose={() => setShowAddModal(false)} onSaved={fetchStudents} />
      )}

      {editingStudent && (
        <StudentFormModal
          mode="edit"
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={fetchStudents}
        />
      )}

    </div>
  )
}
```

- [ ] **Step 6: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/management/StudentRosterView.tsx
git commit -m "feat: wire edit/delete actions into student roster table and drawer"
```

---

### Task 7: CSV/Excel bulk import modal

**Files:**
- Create: `components/dashboard/management/CsvUploadModal.tsx`
- Modify: `components/dashboard/management/StudentRosterView.tsx`

**Interfaces:**
- Consumes: `POST /api/students/bulk` (Task 3) — body `{ students: Array<{name,rollNo,class,section,program,batch,parentContact}>, defaults?: {program?:string; batch?:string; section?:string} }`, response `{ succeeded, failed, total, failedReasons? }`.
- Consumes the `xlsx` package (already a project dependency, proven pattern in `components/dashboard/management/StudentRoster.tsx:1-73,228-273`).
- No automated test for this task (no React component test infra) — verified via `npm run build` plus manual browser check.

- [ ] **Step 1: Create `CsvUploadModal.tsx`**

```tsx
'use client'
import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface ParsedRow {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  parentContact: string
}

interface Defaults {
  program: string
  batch: string
  section: string
}

interface CsvUploadModalProps {
  students: any[]
  onClose: () => void
  onImported: () => void
}

function resolveField(rowValue: string, defaultValue: string): string {
  return defaultValue.trim() ? defaultValue.trim() : rowValue
}

function downloadTemplate() {
  const headers = ['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Parent Contact']
  const data = [
    headers,
    ['Rahul Sharma', '101', 'Grade 10', 'A', 'Science', 'Morning', '9876543210'],
    ['Priya Patel', '102', 'Grade 10', 'A', 'Science', 'Morning', '9123456789'],
    ['Amit Verma', '103', 'Grade 10', 'B', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Students')
  XLSX.writeFile(wb, 'student_roster_template.xlsx')
}

export default function CsvUploadModal({ students, onClose, onImported }: CsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [defaults, setDefaults] = useState<Defaults>({ program: '', batch: '', section: '' })
  const [customField, setCustomField] = useState<{ program: boolean; batch: boolean; section: boolean }>({
    program: false,
    batch: false,
    section: false,
  })
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ succeeded: number; failed: number; total: number } | null>(null)

  const programOptions = Array.from(new Set(students.map((s) => s.program).filter((v) => v && v !== 'Unassigned')))
  const batchOptions = Array.from(new Set(students.map((s) => s.batch).filter((v) => v && v !== 'Unassigned')))
  const sectionOptions = Array.from(new Set(students.map((s) => s.rawSection).filter(Boolean)))

  const handleDefaultSelect = (field: keyof Defaults, value: string) => {
    if (value === '__other__') {
      setCustomField((prev) => ({ ...prev, [field]: true }))
      setDefaults((prev) => ({ ...prev, [field]: '' }))
    } else {
      setCustomField((prev) => ({ ...prev, [field]: false }))
      setDefaults((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setParsedRows([])
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const rows: ParsedRow[] = raw
          .map((r) => {
            const keys = Object.keys(r)
            const get = (variants: string[]) => {
              for (const v of variants) {
                const found = keys.find((k) => k.toLowerCase().replace(/\s+/g, '') === v.toLowerCase())
                if (found) return String(r[found]).trim()
              }
              return ''
            }
            return {
              name: get(['name', 'studentname']),
              rollNo: get(['rollno', 'roll', 'rollnumber', 'id']),
              class: get(['class', 'grade', 'classname']),
              section: get(['section', 'div', 'division']),
              program: get(['program']),
              batch: get(['batch']),
              parentContact: get(['parentcontact', 'contact', 'phone', 'mobile']),
            }
          })
          .filter((r) => r.name)

        if (rows.length === 0) {
          setError('No valid rows found. Make sure at least a Name column exists.')
          return
        }
        setParsedRows(rows)
      } catch {
        setError('Failed to parse file. Please use the provided template or a standard Excel/CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: parsedRows, defaults }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
        return
      }
      setResult(data)
      setParsedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImported()
    } finally {
      setImporting(false)
    }
  }

  const renderDefaultSelect = (field: keyof Defaults, label: string, options: string[]) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
      {customField[field] ? (
        <input
          value={defaults[field]}
          onChange={(e) => setDefaults((prev) => ({ ...prev, [field]: e.target.value }))}
          placeholder={`Custom ${label.toLowerCase()}`}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      ) : (
        <select
          value={defaults[field]}
          onChange={(e) => handleDefaultSelect(field, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
        >
          <option value="">No default — use CSV value</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
          <option value="__other__">Other (type custom value)</option>
        </select>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Upload CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {renderDefaultSelect('program', 'Default Program', programOptions)}
          {renderDefaultSelect('batch', 'Default Batch', batchOptions)}
          {renderDefaultSelect('section', 'Default Section', sectionOptions)}
        </div>
        <p className="text-[11px] text-slate-500 mb-5">
          A default above applies to every row unless the CSV file itself has a value in that column.
        </p>

        <div className="flex items-center justify-between mb-3">
          <label
            htmlFor="csv-upload-file"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Choose File
          </label>
          <input
            ref={fileInputRef}
            id="csv-upload-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button onClick={downloadTemplate} className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 mt-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 mt-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-800 mb-2">Preview — {parsedRows.length} rows (after defaults applied)</p>
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Name', 'Roll No', 'Class', 'Section', 'Program', 'Batch', 'Contact'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                      <td className="px-3 py-2 text-slate-600">{r.rollNo || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.class || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.section, defaults.section) || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.program, defaults.program) || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{resolveField(r.batch, defaults.batch) || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.parentContact || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full mt-4 bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.length} Students`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Wire an "Upload CSV" button into `StudentRosterView.tsx`**

Add the import (combine with Task 6's edit to the same import line — the final import line after Tasks 5, 6, and this step is):

```tsx
import { ChevronDown, X, User, Phone, Briefcase, Loader2, Filter, Plus, Pencil, Trash2, Upload } from 'lucide-react'
import CsvUploadModal from './CsvUploadModal'
```

Add state next to `editingStudent`:

```tsx
  // Edit/Delete
  const [editingStudent, setEditingStudent] = useState<any>(null)

  // CSV upload
  const [showCsvModal, setShowCsvModal] = useState(false)
```

Change the header button wrapper (as left by Task 5) from:

```tsx
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Student
            </button>
            <button onClick={() => showToast('Syncing with SIS...')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4" /> Sync Data
            </button>
          </div>
```

to:

```tsx
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Student
            </button>
            <button onClick={() => setShowCsvModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Upload className="w-4 h-4" /> Upload CSV
            </button>
            <button onClick={() => showToast('Syncing with SIS...')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Filter className="w-4 h-4" /> Sync Data
            </button>
          </div>
```

Render the modal next to the other two modals at the end of the component:

```tsx
      {editingStudent && (
        <StudentFormModal
          mode="edit"
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={fetchStudents}
        />
      )}

      {showCsvModal && (
        <CsvUploadModal
          students={students}
          onClose={() => setShowCsvModal(false)}
          onImported={fetchStudents}
        />
      )}

    </div>
  )
}
```

- [ ] **Step 3: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Manual verification (no automated test infra for this component)**

In the browser, on `/management/students`:
1. Click "Upload CSV" → modal opens.
2. Click "Download Template" → an `.xlsx` downloads with headers `Name, Roll No, Class, Section, Program, Batch, Parent Contact`.
3. Fill in the template with 2-3 rows, leave Program blank on one row, set Program to "Science" on another.
4. Upload it with the "Default Program" dropdown set to "Commerce" → preview table shows every row's Program resolved to "Commerce" (default wins over CSV).
5. Reset the Program default to "No default — use CSV value" and re-upload → preview shows the per-row CSV values, with blank rows showing `—`.
6. Click "Import" → success banner shows correct succeeded/failed/total, roster table refreshes and shows the new students with the right Program/Batch.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/management/CsvUploadModal.tsx components/dashboard/management/StudentRosterView.tsx
git commit -m "feat: add CSV/Excel bulk import modal with program/batch/section defaults"
```

---
