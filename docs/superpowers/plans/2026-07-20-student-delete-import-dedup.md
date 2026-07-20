# Student Delete & CSV Import Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Removing a student from the roster permanently wipes their data from Neon, re-uploading a CSV updates existing students/guardians instead of duplicating them, existing duplicate rows get a one-time cleanup migration, and the fake toast notification is removed.

**Architecture:** Four independent, additive changes to the existing Students API surface: (1) `POST /api/students/bulk` gains guardian-upsert and broader student-match-key logic; (2) `DELETE /api/students` always hard-deletes (relies on existing `ON DELETE CASCADE` FKs already in `lib/db/schema.ts`); (3) `StudentRosterView.tsx` calls the hard-delete path and drops its fake-notification interval; (4) a new SQL migration cleans up duplicates already sitting in Neon.

**Tech Stack:** Next.js API routes, Drizzle ORM (`drizzle-orm/neon-http`), Neon Postgres, Jest for route tests.

## Global Constraints

- Test cleanup must be scoped-by-ID deletes only — never an unscoped `db.delete(table)` with no `WHERE` (see `app/api/students/route.test.ts:16-19` comment: the DB Guard silently no-ops unscoped deletes, so relying on it lets rows accumulate across runs). `app/api/students/bulk/route.test.ts` currently uses unscoped `await db.delete(students)` in its `afterEach` — leave that file's existing pattern alone except where a new test you add needs its own scoped cleanup; do not "fix" the existing unscoped cleanup as part of this plan (out of scope, unrelated to these bugs).
- No Co-Authored-By trailer or Claude Code footer in any commit message.
- Never print real Neon connection strings or secret values in command output shown to the user.
- The cleanup migration (Task 4) is destructive against production data and must be run by the user via `npm run db:migrate` — do not attempt to run it yourself.

---

### Task 1: Guardian upsert on CSV import

**Files:**
- Modify: `app/api/students/bulk/route.ts:79-89`
- Test: `app/api/students/bulk/route.test.ts`

**Interfaces:**
- Consumes: `parentsGuardians` table from `@/lib/db/schema` (already imported in this file), `db` from `@/lib/db` (already imported), `and`/`eq` from `drizzle-orm`.
- Produces: nothing new consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Write the failing test**

Add to `app/api/students/bulk/route.test.ts`, inside `describe('POST /api/students/bulk', ...)`, after the existing `'upserts rows with rollNo+class+section...'` test:

```ts
  it('upserts the primary guardian instead of duplicating it on repeat import', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const row = {
      name: 'Guardian Test', rollNo: '002', class: '11 - A', section: 'A',
      guardianName: 'ABC', guardianPhone: '9876543210', guardianEmail: 'suresh.sharma@example.com',
    }
    await POST(req({ students: [row] }))
    await POST(req({ students: [{ ...row, guardianPhone: '9998887770' }] }))

    const [student] = await db.select().from(students).where(eq(students.rollNo, '002'))
    const guardianRows = await db.select().from(parentsGuardians).where(eq(parentsGuardians.studentId, student.id))
    expect(guardianRows).toHaveLength(1)
    expect(guardianRows[0].phone).toBe('9998887770')
  })
```

Add the needed imports at the top of the file (`parentsGuardians` and `eq` are not currently imported in the test file):

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, parentsGuardians } from '@/lib/db/schema'
```

(Replace the existing `import { db } from '@/lib/db'` and `import { students } from '@/lib/db/schema'` lines at the top of the test file with the versions above — same imports, `parentsGuardians` and `eq` added.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/students/bulk/route.test.ts -t "upserts the primary guardian"`
Expected: FAIL — `guardianRows` has length 2, not 1 (current code always inserts a new guardian row).

- [ ] **Step 3: Implement the guardian upsert**

In `app/api/students/bulk/route.ts`, add `and` to the existing drizzle-orm import:

```ts
import { and, eq } from 'drizzle-orm'
```

Replace lines 79-89 (the `const guardianName = ...` block through the closing `}`) with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/students/bulk/route.test.ts`
Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Commit**

```bash
git add app/api/students/bulk/route.ts app/api/students/bulk/route.test.ts
git commit -m "fix: upsert primary guardian on CSV re-import instead of duplicating"
```

---

### Task 2: Student match-key fallback for CSV import (Admission Number, then Name+Class+Section)

**Files:**
- Modify: `lib/db/queries/students.ts:78-99` (add two new functions after `upsertStudentByRollClassSection`)
- Modify: `app/api/students/bulk/route.ts` (import + call the new functions)
- Test: `app/api/students/bulk/route.test.ts`

**Interfaces:**
- Consumes: `students` table, `Student`/`NewStudent` types, `db`, `eq`/`and` from `drizzle-orm` — all already imported in `lib/db/queries/students.ts`.
- Produces: `upsertStudentByAdmissionNumber(data: NewStudent): Promise<Student>` and `upsertStudentByNameClassSection(data: NewStudent): Promise<Student>`, both exported from `lib/db/queries/students.ts`, used by Task 2's own route wiring (no later task depends on these).

- [ ] **Step 1: Write the failing tests**

Add to `app/api/students/bulk/route.test.ts`, inside `describe('POST /api/students/bulk', ...)`, after the guardian-upsert test from Task 1:

```ts
  it('upserts by admission number when rollNo/class/section are incomplete', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const row = { name: 'Admission Match', admissionNumber: `ADM-${Date.now()}` }
    await POST(req({ students: [row] }))
    await POST(req({ students: [{ ...row, name: 'Admission Match Updated' }] }))

    const rows = await db.select().from(students).where(eq(students.admissionNumber, row.admissionNumber))
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Admission Match Updated')
  })

  it('upserts by name+class+section when no rollNo or admission number is present', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const row = { name: 'Name Match', class: '9 - B', section: 'B' }
    await POST(req({ students: [row] }))
    await POST(req({ students: [{ ...row, phone: '9998887770' }] }))

    const rows = await db.select().from(students).where(eq(students.name, 'Name Match'))
    expect(rows).toHaveLength(1)
    expect(rows[0].phone).toBe('9998887770')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/api/students/bulk/route.test.ts -t "upserts by"`
Expected: FAIL — both tests find 2 rows instead of 1 (current code always inserts when rollNo/class/section aren't all present).

- [ ] **Step 3: Add the query helpers**

In `lib/db/queries/students.ts`, insert after `upsertStudentByRollClassSection` (after line 99, before `export async function updateStudent`):

```ts
export async function upsertStudentByAdmissionNumber(data: NewStudent): Promise<Student> {
  const conditions: any[] = [eq(students.admissionNumber, data.admissionNumber ?? '')]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))

  const existing = await db.select().from(students).where(and(...conditions))
  if (existing[0]) {
    const updated = await db
      .update(students)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id))
      .returning()
    return updated[0]
  }
  return createStudent(data)
}

export async function upsertStudentByNameClassSection(data: NewStudent): Promise<Student> {
  const conditions: any[] = [
    eq(students.name, data.name),
    eq(students.class, data.class ?? ''),
    eq(students.section, data.section ?? ''),
  ]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))

  const existing = await db.select().from(students).where(and(...conditions))
  if (existing[0]) {
    const updated = await db
      .update(students)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id))
      .returning()
    return updated[0]
  }
  return createStudent(data)
}
```

- [ ] **Step 4: Wire the fallback into the bulk import route**

In `app/api/students/bulk/route.ts`, update the import line for query functions:

```ts
import {
  upsertStudentByRollClassSection,
  upsertStudentByAdmissionNumber,
  upsertStudentByNameClassSection,
  createStudent,
  deleteAllStudents,
} from '@/lib/db/queries/students'
```

Replace the existing student-creation lines:

```ts
        // If rollNo + class + section all present → upsert (prevents duplicates)
        // Otherwise → plain insert (name-only rows are always added)
        const student = rollNo && cls && section
          ? await upsertStudentByRollClassSection(data)
          : await createStudent(data)
```

with:

```ts
        // Match on the most specific available key so re-imports update
        // instead of duplicating: rollNo+class+section, then admission
        // number, then name+class+section. Bare-name-only rows have no
        // reliable key and always insert fresh.
        let student
        if (rollNo && cls && section) {
          student = await upsertStudentByRollClassSection(data)
        } else if (data.admissionNumber) {
          student = await upsertStudentByAdmissionNumber(data)
        } else if (cls && section) {
          student = await upsertStudentByNameClassSection(data)
        } else {
          student = await createStudent(data)
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest app/api/students/bulk/route.test.ts`
Expected: PASS — all tests in the file.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/db/queries/students.ts app/api/students/bulk/route.ts app/api/students/bulk/route.test.ts
git commit -m "fix: dedupe CSV student re-imports by admission number or name+class+section"
```

---

### Task 3: Hard delete on Remove

**Files:**
- Modify: `app/api/students/route.ts:140-166` (DELETE handler)
- Modify: `lib/db/queries/students.ts:111-113` (remove `deactivateStudent`)
- Modify: `components/dashboard/management/StudentRosterView.tsx:108-124` (`handleDelete`)
- Test: `app/api/students/route.test.ts:209-234`

**Interfaces:**
- Consumes: `deleteStudent(id: string, schoolId?: string | null): Promise<void>` from `lib/db/queries/students.ts` (already exists, unchanged).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Update the failing/changing tests**

Replace the entire `describe('DELETE /api/students', ...)` block (lines 209-234 of `app/api/students/route.test.ts`) with:

```ts
describe('DELETE /api/students', () => {
  it('permanently deletes the student, even without a permanent param', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()
    createdIds.push(created.id)

    const res = await DELETE(req(`http://localhost/api/students?id=${created.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)

    const rows = await db.select().from(students).where(eq(students.id, created.id))
    expect(rows).toHaveLength(0)
  })

  it('cascades the delete to the student\'s guardians', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()
    createdIds.push(created.id)
    await db.insert(parentsGuardians).values({ studentId: created.id, name: 'ABC', isPrimary: true })

    await DELETE(req(`http://localhost/api/students?id=${created.id}`, { method: 'DELETE' }))

    const guardianRows = await db.select().from(parentsGuardians).where(eq(parentsGuardians.studentId, created.id))
    expect(guardianRows).toHaveLength(0)
  })
})
```

Add `parentsGuardians` to the existing schema import at the top of the file:

```ts
import { students, parentsGuardians } from '@/lib/db/schema'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/api/students/route.test.ts -t "DELETE /api/students"`
Expected: FAIL — first test fails because the current default is soft-delete (`rows` still has the row, `isActive: false` not empty). Second test fails for the same reason (guardian row's `studentId` still points at a row that was never hard-deleted, so cascade never fired).

- [ ] **Step 3: Simplify the DELETE handler**

In `app/api/students/route.ts`, replace lines 140-166 (the whole `DELETE` export) with:

```ts
// DELETE — permanently delete a student and cascade-delete their
// guardians/enrollments (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove students' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    await deleteStudent(id, schoolId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Update the import line at the top of the file to drop `deactivateStudent`:

```ts
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  type ListStudentsFilters,
} from '@/lib/db/queries/students'
```

- [ ] **Step 4: Remove the now-unused `deactivateStudent` query function**

In `lib/db/queries/students.ts`, delete lines 111-113:

```ts
export async function deactivateStudent(id: string, schoolId?: string | null): Promise<Student | null> {
  return updateStudent(id, { isActive: false }, schoolId)
}
```

- [ ] **Step 5: Update the UI to reflect permanence**

In `components/dashboard/management/StudentRosterView.tsx`, replace lines 108-124 (`handleDelete`) with:

```ts
  const handleDelete = async (student: any) => {
    if (!confirm(`Permanently delete ${student.name} and all their guardian and enrollment records? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/students?id=${student._id}`, { method: 'DELETE' })
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s._id !== student._id))
        if (selectedStudent?._id === student._id) {
          setSelectedStudent(null)
        }
        showToast(`${student.name} permanently deleted`)
      } else {
        showToast('Failed to delete student')
      }
    } catch {
      showToast('Failed to delete student')
    }
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest app/api/students/route.test.ts`
Expected: PASS — all tests in the file.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/api/students/route.ts app/api/students/route.test.ts lib/db/queries/students.ts components/dashboard/management/StudentRosterView.tsx
git commit -m "fix: make student removal a permanent delete instead of a soft deactivate"
```

---

### Task 4: Remove the fake toast notification

**Files:**
- Modify: `components/dashboard/management/StudentRosterView.tsx:43-56`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Delete the fake-notification effect**

In `components/dashboard/management/StudentRosterView.tsx`, delete lines 43-56:

```ts
  // Simulate real-time updates / notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const randomNotifications = [
        "Attendance summary synced with parent portal.",
        "1 new student admission application received.",
        "Batch 2024 registry check completed successfully.",
        "System backup and log rotation executed."
      ]
      const msg = randomNotifications[Math.floor(Math.random() * randomNotifications.length)]
      showToast(`🔔 Real-time info: ${msg}`)
    }, 30000) // every 30s
    return () => clearInterval(interval)
  }, [])
```

Leave the `handleRefresh` function (lines 36-41) and its real `showToast('🔄 Real-time Sync: Roster updated successfully.')` call untouched — that one fires on an actual user action.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other code in the file referenced the removed effect).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/management/StudentRosterView.tsx
git commit -m "fix: remove fake interval-based toast notification from student roster"
```

---

### Task 5: Neon cleanup migration for existing duplicates

**Files:**
- Create: `lib/db/migrations/0030_dedupe_students_guardians.sql`
- Modify: `lib/db/migrations/meta/_journal.json`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SQL against existing tables).
- Produces: nothing consumed by later tasks. This is the last task in the plan.

- [ ] **Step 1: Write the migration file**

Create `lib/db/migrations/0030_dedupe_students_guardians.sql`:

```sql
-- Keep only the most-recently-updated primary guardian per student; drop the rest.
-- (Fixes duplicate primary guardians created by the pre-fix CSV import, which
-- inserted a new guardian row on every re-import instead of updating one.)
DELETE FROM parents_guardians pg
USING (
  SELECT id, student_id,
         ROW_NUMBER() OVER (PARTITION BY student_id, is_primary ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM parents_guardians
  WHERE is_primary = true
) ranked
WHERE pg.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint
-- Drop students that are exact duplicates on every identifying field, keeping
-- the most recently created row. Only collapses TRUE duplicates (identical on
-- name, class, section, roll_no, admission_number, and school_id) — never
-- merges two different students who happen to share a name.
DELETE FROM students s
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY name, class, section, roll_no, COALESCE(admission_number, ''), COALESCE(school_id::text, '')
           ORDER BY created_at DESC
         ) AS rn
  FROM students
) ranked
WHERE s.id = ranked.id AND ranked.rn > 1;
```

- [ ] **Step 2: Register the migration in the journal**

In `lib/db/migrations/meta/_journal.json`, add a new entry to the `entries` array, after the `0029_program_id_on_batches` entry (which is `idx: 15`):

```json
    {
      "idx": 16,
      "version": "7",
      "when": 1784955300000,
      "tag": "0030_dedupe_students_guardians",
      "breakpoints": true
    }
```

(Insert this object after the `0029_program_id_on_batches` entry, adding a comma after that entry's closing `}` — the array's final entry must not have a trailing comma.)

- [ ] **Step 3: Verify the SQL is syntactically valid**

Run: `npx tsc --noEmit`
Expected: no errors (this step doesn't touch TypeScript, but confirms the rest of the branch still typechecks cleanly after all five tasks — the actual SQL is validated by the user running it in Step 4).

- [ ] **Step 4: Commit**

```bash
git add lib/db/migrations/0030_dedupe_students_guardians.sql lib/db/migrations/meta/_journal.json
git commit -m "chore: add migration to dedupe existing duplicate students and guardians"
```

- [ ] **Step 5: Tell the user to run the migration**

This step has no code — it's a reminder for whoever executes this plan (human or agent) to explicitly tell the user, after all tasks are committed:

> "Run `npm run db:migrate` to apply the cleanup migration against Neon — it will remove the existing duplicate guardian and student rows. This is destructive and cannot be undone, so it must be run by you, not by me."

---

## Self-Review Notes

- **Spec coverage:** Hard delete → Task 3. Guardian upsert → Task 1. Student match-key fallback → Task 2. Cleanup migration → Task 5. Remove fake notification → Task 4. All five spec sections covered.
- **Placeholder scan:** No TBD/TODO; every step has literal code or an exact command.
- **Type consistency:** `upsertStudentByAdmissionNumber` / `upsertStudentByNameClassSection` (Task 2) both return `Promise<Student>` matching `upsertStudentByRollClassSection`'s existing signature and the `student` variable's usage in the route (`student.id` used for guardian linking in Task 1, both tasks touch the same route file — Task 1 lands first, Task 2's Step 4 replaces a different, non-overlapping block of the same file, so no merge conflict between them).
