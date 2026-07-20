# Student Delete & CSV Import Dedup — Design

## Problem

In the management Student Roster (`StudentRosterView.tsx`, `/management/students`):

1. **"Remove" doesn't actually delete.** `handleDelete` calls `DELETE /api/students?id=…` without `permanent=true`, which routes to `deactivateStudent()` — a soft delete (`isActive: false`). The student row and all their `parents_guardians` rows stay in Neon forever, just hidden from the active roster view.
2. **CSV import never dedupes guardians.** `POST /api/students/bulk` unconditionally `INSERT`s a new `parents_guardians` row whenever a CSV row has a `guardianName`, with no check for an existing guardian on that student. Re-uploading the same CSV (or re-adding a student who still has a stale, soft-deleted row) creates a fresh duplicate guardian every time — this is what produces the duplicate "ABC" parent entries visible in the Student Profile drawer.
3. **CSV import only dedupes students when rollNo+class+section are all present.** `upsertStudentByRollClassSection` is only called when all three fields are non-empty; otherwise the row always goes through `createStudent()`, inserting a new student row on every re-upload.
4. **A fake toast notification fires every 30s.** A `setInterval` in `StudentRosterView.tsx` (lines ~43-56) picks a random canned message ("Batch 2024 registry check completed successfully.", etc.) and shows it via `showToast`. It's not tied to any real event.

Note: the Neon `users` table screenshot the user shared is unrelated — guardians live in `parents_guardians`, not `users`. `users` only holds `teacher`/`management` login accounts (`userRoleEnum`). No changes are planned for `users`.

## Goals

- Removing a student from the roster permanently wipes that student and their guardian/enrollment data from Neon.
- Re-uploading an unchanged or updated CSV updates existing matching students/guardians in place instead of creating duplicates.
- Existing duplicate rows already in Neon (from past soft-deletes and repeat imports) get cleaned up once, via a migration the user runs the same way as previous migrations (`npm run db:migrate`).
- The fake interval-based toast notification is removed. The real "Roster updated successfully" toast on manual refresh stays.

## Non-goals

- No UI for restoring a deleted student — hard delete is intentionally irreversible, matching the user's explicit request.
- No changes to the `users` table or its dedup — out of scope, unrelated table.
- No guaranteed dedup for CSV rows that have only a bare `name` (no admission number, no class+section) — there is no reliable key to match on, so these always insert fresh, as today. This is a documented limitation, not a bug to fix.
- `StudentRoster.tsx` (an older, currently-unused component with its own deactivate/permanent-delete UI) is not wired into any page and is out of scope — not touched.

## Design

### 1. Hard delete on "Remove"

- `components/dashboard/management/StudentRosterView.tsx`, `handleDelete`: change the fetch URL to `DELETE /api/students?id=${student._id}&permanent=true`. Update the `confirm()` text to make the permanence explicit: `Permanently delete ${student.name} and all their guardian and enrollment records? This cannot be undone.`
- `app/api/students/route.ts` DELETE handler: since every caller now always passes `permanent=true`, remove the `permanent` query-param branch and the now-dead `deactivateStudent` call — the handler always calls `deleteStudent(id, schoolId)`.
- `lib/db/queries/students.ts`: remove `deactivateStudent` (now unused).
- No schema changes needed: `parents_guardians.student_id` and `student_batch_enrollments.student_id` already have `ON DELETE CASCADE` in `lib/db/schema.ts` (lines 148, 173) — a real `DELETE FROM students WHERE id = …` cascades automatically.
- `listStudents` already filters `isActive` by default but that flag becomes vestigial for rows created going forward (all students stay `isActive: true` until hard-deleted). No change required there — `isActive`/`status` remain in the schema for other features (e.g. CSV `status` column marking a student inactive without deleting them), only the *delete* action changes.

### 2. Guardian upsert on CSV import

- `app/api/students/bulk/route.ts`, inside the per-row `Promise.allSettled` handler: replace the unconditional `db.insert(parentsGuardians)` with an upsert against the student's existing primary guardian:

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

- Requires importing `and` from `drizzle-orm` in this file (currently only default import usage of `db`/`parentsGuardians`).

### 3. Student upsert fallback for CSV import

- `app/api/students/bulk/route.ts`: add a query helper (in `lib/db/queries/students.ts`) alongside `upsertStudentByRollClassSection`:

```ts
export async function upsertStudentByAdmissionNumber(data: NewStudent): Promise<Student> {
  const conditions: any[] = [eq(students.admissionNumber, data.admissionNumber ?? '')]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))
  const existing = await db.select().from(students).where(and(...conditions))
  if (existing[0]) {
    const updated = await db.update(students).set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id)).returning()
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
    const updated = await db.update(students).set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id)).returning()
    return updated[0]
  }
  return createStudent(data)
}
```

- In `app/api/students/bulk/route.ts`, replace the current:

```ts
const student = rollNo && cls && section
  ? await upsertStudentByRollClassSection(data)
  : await createStudent(data)
```

with:

```ts
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
```

(`admissionNumber` requires `name`+`class`+`section` not both being empty to be meaningful, but the admission-number branch is checked first since it's the more specific/reliable key when present.)

### 4. Neon cleanup migration

New Drizzle migration (numbered after the existing latest one), run via the existing `npm run db:migrate` pipeline:

```sql
-- Keep only the most-recently-updated primary guardian per student; drop the rest.
DELETE FROM parents_guardians pg
USING (
  SELECT id, student_id,
         ROW_NUMBER() OVER (PARTITION BY student_id, is_primary ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM parents_guardians
  WHERE is_primary = true
) ranked
WHERE pg.id = ranked.id AND ranked.rn > 1;

-- Drop students that are exact duplicates on every identifying field, keeping the most recent.
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

- The student-dedup cascades to that row's own `parents_guardians`/`student_batch_enrollments` automatically (FK cascade), so no separate cleanup needed for those.
- This is destructive against production data — the user runs `npm run db:migrate` themselves, same as the Program/Batch migration.

### 5. Remove fake notification

- `components/dashboard/management/StudentRosterView.tsx`: delete the `useEffect` block (lines ~43-56) containing the `setInterval` and `randomNotifications` array. Leave `handleRefresh`'s real toast (line 40) untouched.

## Testing

- `app/api/students/route.test.ts`: update/add a test asserting `DELETE ?id=X` (no `permanent` param needed now, or confirm it's still accepted/ignored) results in the student row being gone (not just `isActive: false`), and that a scoped-by-ID cascade check confirms associated `parents_guardians` rows are also gone.
- `app/api/students/bulk/route.test.ts`: add tests for (a) importing the same CSV row twice with a `guardianName` results in exactly one `parents_guardians` row for that student, updated not duplicated; (b) importing the same admission-number row twice (no rollNo/class/section) results in one student row, not two; (c) importing the same name+class+section row twice (no rollNo, no admission number) results in one student row.
