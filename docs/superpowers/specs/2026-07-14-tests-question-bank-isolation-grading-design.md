# Tests & Question Bank: Faculty Isolation, Grading, and Paper Attachments — Design

## Overview

The Tests & Question Bank feature (admin: `TestsBankView.tsx`, faculty:
`TeacherTestsView.tsx`, tables `tests` and `questions`) currently has three
gaps:

1. **No per-faculty ownership.** `tests` and `questions` are scoped only by
   `schoolId`. Every teacher in a school sees every other teacher's tests
   and question-bank entries, and can edit or delete them.
2. **No grading workflow reachable from the UI.** `app/api/tests/results/
   route.ts` implements a per-student marks sheet, but it is backed by
   MongoDB (`models/TestResult.ts`), contains hardcoded mock-student
   seeding data ("Kunal Dadlani", "Ayush Patel", "Kunal Singhi") and a
   fragile `resolveClassFromBatch()` string-matching hack, and is not
   linked from any button in either `TestsBankView.tsx` or
   `TeacherTestsView.tsx`. It is dead code today.
3. **No test-paper attachment.** The only PDF upload path
   (`/api/tests/questions/upload-pdf`) parses a PDF into individual
   question-bank rows. There is no way to attach the actual test paper
   document to a scheduled test for admin/faculty to preview.

This design adds faculty ownership and isolation to tests and questions,
replaces the Mongo-backed grading system with a Postgres one wired into
real UI, adds test-paper PDF attachment with an authorized preview route,
and surfaces live test performance in Student Reports for both roles.

## Goals

- A teacher can create tests and question-bank entries that only they (and
  management) can see, edit, delete, or grade.
- Management continues to see everything created in their school, with a
  faculty attribution column and filter.
- A teacher can attach the actual test-paper PDF to a scheduled test;
  management and the owning teacher can preview/download it; no one else
  can.
- A teacher can grade a test once its date has arrived, entering
  marks/correct/incorrect/unattempted/absent per student on the real batch
  roster (not a hardcoded mock roster).
- Management can see grading results filtered by batch and program.
- Student Reports (both roles) show a student's recent test performance,
  computed live from the same grading table — no duplicated/stale data.
- No cross-school data leakage, consistent with every other multi-tenant
  surface in this codebase.

## Non-Goals

- No change to the existing PDF-to-question-bank parser
  (`/api/tests/questions/upload-pdf`) — it keeps parsing PDFs into
  questions exactly as it does today; test-paper PDFs are a separate,
  unparsed attachment.
- No student-facing UI. Grading and papers are admin/faculty only.
- No change to how `classSchedules`/`attendanceSessions`/assignments work.
- No retroactive backfill of `created_by_user_id` for existing rows —
  they become admin/legacy-only per the decision below.

## Data Model

Migration file: `lib/db/migrations/0026_test_ownership_grading_papers.sql`,
applied via `node scripts/apply-migration.mjs` (update its `readFileSync`
path to this file first) and verified against Neon.

### `tests` — add columns

```sql
ALTER TABLE tests
  ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN program varchar(255) NOT NULL DEFAULT '',
  ADD COLUMN paper_url text,
  ADD COLUMN paper_file_name varchar(255);
```

- `created_by_user_id` is nullable. `NULL` means the row predates this
  migration (or was created directly by management without a specific
  owning teacher) — it is treated as admin/legacy: visible to management
  only, never to any teacher.
- `program` is denormalized the same way `students.program` and
  `classSchedules`-adjacent tables already denormalize program/batch — set
  at creation time from the form, used for admin-side filtering. Empty
  string default keeps existing rows valid without a backfill.
- `paper_url` / `paper_file_name` describe the attached test-paper PDF (Blob
  pathname + original filename for display). Both null until a paper is
  uploaded.

### `questions` — add column

```sql
ALTER TABLE questions
  ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
```

Same nullable/legacy semantics as `tests.created_by_user_id`.

### New table: `test_grades`

```sql
CREATE TABLE test_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  roll_no varchar(255) NOT NULL DEFAULT '',
  marks_obtained integer,
  correct integer,
  incorrect integer,
  unattempted integer,
  absent boolean NOT NULL DEFAULT false,
  graded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);
CREATE INDEX test_grades_test_id_idx ON test_grades(test_id);
CREATE INDEX test_grades_student_id_idx ON test_grades(student_id);
```

- `marks_obtained`/`correct`/`incorrect`/`unattempted` are `NULL` for a
  student who has not been graded yet or who is marked `absent`.
- No stored `percentage` or `rank` — both are computed at read time
  (percentage from `marks_obtained / tests.total_marks`; rank by sorting
  present students' marks descending), the same live-computation
  discipline used for attendance percentages.
- `school_id` is carried directly on the row (not just reachable via
  `test_id → tests.school_id`) so every query can filter tenant scope in
  one join-free condition, consistent with every other table in this
  schema.

Add corresponding Drizzle table + `Test`/`NewTest` style exported types in
`lib/db/schema.ts`, following the existing `tests`/`questions` block.

### Retire Mongo `TestResult`

`models/TestResult.ts` and all of its usages in
`app/api/tests/results/route.ts` are deleted, not deprecated in place —
the route is rewritten against `test_grades` (see API section). The
`.next/test_results_fallback.json` local-fallback file mechanism is
removed with it.

## Ownership & Isolation Rules

These rules apply uniformly to `tests`, `questions`, and `test_grades`:

| Role | Visibility | Create | Edit / Delete | Grade |
|---|---|---|---|---|
| `teacher` | Rows where `created_by_user_id = session.user.id` AND `school_id` matches | `created_by_user_id` set to `session.user.id` | Only own rows | Only own tests |
| `management` | All rows where `school_id` matches (including legacy `NULL`-owner rows) | `created_by_user_id` set to `session.user.id` (their own management account) | Any row in school | Any test in school |

`schoolId` comes from `getSchoolId(session)` (`lib/auth.ts`), same as every
other route in this codebase. A request with no matching `schoolId` never
falls back to "all schools" — mirrors the existing pattern everywhere else.

Management-facing list responses join the owning teacher's display name
(via `faculty` / `users` — same join already used elsewhere for faculty
name resolution) into a `facultyName` field per row, and management gets a
faculty dropdown filter on both the Tests list and the Question Bank
Overview.

## API Endpoints

### `app/api/tests/schedule/route.ts` (modify)

- `GET`: add teacher-ownership condition when `role === 'teacher'`
  (`eq(tests.createdByUserId, session.user.id)`), in addition to the
  existing `schoolId` condition. Management path unchanged except it now
  also selects `createdByUserId` and joins faculty name. Add optional
  `program` query param filter (`eq(tests.program, program)`) for
  management's batch+program filtering.
- `POST`: set `createdByUserId: session.user.id` and persist the new
  `program` field from the request body (required, matches existing
  `batch`/`subject` validation style).
- `PUT` / `DELETE`: add the same ownership condition as `GET` when
  `role === 'teacher'` — a teacher's `condition` becomes
  `and(eq(tests.id, id), eq(tests.schoolId, schoolId), eq(tests.createdByUserId, session.user.id))`.
  Management keeps the current schoolId-only condition.

### `app/api/tests/questions/route.ts` (modify)

Same shape of changes as `schedule/route.ts`: `GET`/`PUT`/`DELETE` add the
teacher-ownership condition; `POST` sets `createdByUserId`. Management
`GET` joins faculty name and accepts an optional `teacherId` filter param.

### `app/api/tests/questions/upload-pdf/route.ts` (modify)

Bulk-inserted rows also get `createdByUserId: session.user.id` (currently
missing entirely). No other change — this route keeps parsing PDFs into
question-bank rows exactly as today, per the Non-Goals section.

### `app/api/tests/[id]/paper/route.ts` (new)

- `POST` (multipart, `file` field): authorize — management (schoolId
  match) or the test's owning teacher only, else 403. Validate `.pdf`
  extension. Upload via `put(`test-papers/${testId}-${Date.now()}-${safeName}`, file, { access: 'private' })`
  (same pattern as `app/api/assignments/upload/route.ts`). Update
  `tests.paperUrl` / `tests.paperFileName`.
- `GET`: same authorization check (management: schoolId match; teacher:
  must be the owning teacher). If authorized, `get(test.paperUrl, { access: 'private' })`
  and stream the result with `Content-Type`/`Content-Disposition` headers,
  the same pattern already proven in `app/api/blob/serve/route.ts`. If the
  test has no `paperUrl`, 404. This is a dedicated route rather than
  reusing `/api/blob/serve` specifically because it needs to check test
  ownership before streaming, not just "is there a session" — a raw blob
  URL must never be handed to the client for this file.
- `DELETE`: same authorization; clears `paperUrl`/`paperFileName` on the
  test row (the underlying blob is left in storage — consistent with how
  the rest of the codebase already treats blob deletion as out of scope).

### `app/api/tests/[id]/grades/route.ts` (new, replaces `app/api/tests/results/route.ts`)

- `GET`: authorize (management: schoolId match; teacher: must own the
  test). Fetch the test, fetch the real batch roster
  (`db.select().from(students).where(and(eq(students.batch, test.batch), eq(students.isActive, true), eq(students.schoolId, schoolId)))`,
  extracted as `findStudentsByBatch(batch, schoolId)` into
  `lib/db/queries/students.ts` so it isn't duplicated from the attendance
  route's private helper), left-join existing `test_grades` rows for that
  test. For each roster student return
  `{ studentId, studentName, rollNo, marksObtained, correct, incorrect, unattempted, absent, percentage, rank }`
  with `percentage`/`rank` computed in the route (not stored). Sort by
  student name.
- `POST`: authorize the same way as `GET`. Body:
  `{ grades: [{ studentId, marksObtained, correct, incorrect, unattempted, absent }] }`.
  Upsert one `test_grades` row per entry (`onConflictDoUpdate` on
  `(test_id, student_id)`), stamping `gradedByUserId: session.user.id`.
  Each upserted row's `school_id` is set from the test's own `schoolId`
  (not the grading user's session), so a management user grading across
  their school still produces correctly-scoped rows. Recompute
  `tests.averageScore` from present students' percentages and set
  `tests.status = 'Graded'`. Reuses the existing
  `notifyRoleInSchool(['teacher','management'], schoolId, {...})` call
  already present in the old route, pointed at the same
  `/teacher/tests` / `/management/tests-bank` links.
- Grading is only permitted (both routes 409 otherwise) when
  `test.date <= getLocalToday()` (from `lib/scheduleUtils.ts`, the same
  IST-safe helper that fixed the earlier attendance timezone bug) — a test
  cannot be graded before its date arrives.

### `app/api/tests/stats/route.ts` (modify)

No structural change; `pendingGrading`/`avgScore`/`batchAverages` continue
to read from `tests.status`/`tests.averageScore`, which the new grades
route keeps populated exactly as the old one did.

### `lib/db/queries/tests.ts` (new)

```ts
export interface TestPerformanceEntry {
  testId: string
  title: string
  subject: string
  date: string
  marksObtained: number | null
  totalMarks: number
  percentage: number | null
  absent: boolean
}

export async function computeTestPerformance(
  studentId: string,
  schoolId: string | null
): Promise<TestPerformanceEntry[]>
```

Joins `test_grades` → `tests` for the given student (and `schoolId` if
present), orders by `tests.date` descending. `percentage` is `null` when
`absent` or ungraded. This is the query both Student Reports views call —
see below.

## Grading UI

New shared modal component `components/dashboard/TestGradingModal.tsx`,
used by both `TestsBankView.tsx` (management) and `TeacherTestsView.tsx`
(faculty) — same component, no duplication, since the grading table shape
and save flow are identical for both roles; only the surrounding
page/permissions differ (management can open it for any test in the
school, faculty only for their own).

- Props: `{ isOpen, onClose, test, onSaved }`.
- On open: `GET /api/tests/[id]/grades`, render one row per roster student
  with number inputs for Marks/Correct/Incorrect/Unattempted and an
  Absent checkbox (disables the other inputs for that row when checked).
- Save button: `POST /api/tests/[id]/grades`, then `onSaved()` to refresh
  the parent list.
- If the test date is in the future, the modal isn't reachable — the
  "Grade" action on the row is replaced with a disabled "Upcoming" badge.

Both `TestsBankView.tsx` and `TeacherTestsView.tsx` tests tables gain:
- A **Faculty** column (management view only), populated from the
  `facultyName` the list API now joins in, plus a faculty filter dropdown
  next to the existing Batch/Type/Status filters.
- A **Program** column/filter (both views), from the new `tests.program`
  field.
- A **Paper** icon-button per row: shows an upload control when no paper
  is attached yet (owning teacher only), or a preview/download link
  (`/api/tests/[id]/paper`, opened in a new tab) once one exists.
- A **Grade** action per row (replacing nothing — this is new), gated by
  ownership and by the test date as described above.

## Student Reports Integration

- `lib/db/queries/tests.ts`'s `computeTestPerformance()` is called from:
  - `app/api/student-reports/[id]/route.ts` (already enriches with
    `computeStudentAttendance`/`computeAssignmentAverage` — add
    `testPerformance` alongside them in the same response shape).
  - `app/api/teacher-portal/students/[id]/route.ts` (same pattern, already
    calls `computeStudentAttendance`).
- `components/dashboard/ReportDetailModal.tsx` and
  `components/dashboard/teacher/TeacherStudentReportsView.tsx` render a
  "Recent Test Performance" list (test title, subject, date, marks/%,
  or "Absent") from this new field — same visual treatment tier as the
  existing attendance/assignment sections in those components.

## Migration & Cleanup Checklist

- [ ] `lib/db/schema.ts`: add `createdByUserId`/`program`/`paperUrl`/
      `paperFileName` to `tests`, `createdByUserId` to `questions`, new
      `testGrades` table + types.
- [ ] `lib/db/migrations/0026_test_ownership_grading_papers.sql`, applied
      and verified against Neon.
- [ ] Delete `models/TestResult.ts` and the `.next/test_results_fallback.json`
      fallback mechanism.
- [ ] Rewrite `app/api/tests/results/route.ts` → `app/api/tests/[id]/grades/route.ts`
      (delete the old file once the new one is live and referenced).
- [ ] `lib/db/queries/students.ts`: add `findStudentsByBatch()`.
- [ ] `lib/db/queries/tests.ts`: new file, `computeTestPerformance()`.
- [ ] Ownership filtering added to `tests/schedule`, `tests/questions`,
      `tests/questions/upload-pdf`.
- [ ] New `app/api/tests/[id]/paper/route.ts`.
- [ ] New `app/api/tests/[id]/grades/route.ts`.
- [ ] `components/dashboard/TestGradingModal.tsx` (new, shared).
- [ ] `TestsBankView.tsx` / `TeacherTestsView.tsx`: Faculty/Program
      columns+filters, Paper button, Grade action.
- [ ] `ReportDetailModal.tsx` / `TeacherStudentReportsView.tsx`: Recent
      Test Performance section.
- [ ] `app/api/student-reports/[id]/route.ts` /
      `app/api/teacher-portal/students/[id]/route.ts`: wire in
      `computeTestPerformance`.

## Testing

- Route tests (mirroring the existing `.test.ts` files for
  `app/api/tests/results/route.test.ts`, rewritten for the new endpoint):
  a teacher cannot see/edit/grade another teacher's test or question; a
  teacher cannot grade a test dated in the future; management sees all
  tests/questions in their school including legacy `NULL`-owner rows, but
  never rows from another school; the paper route rejects a non-owning
  teacher and a different-school management user.
- `lib/db/queries/tests.test.ts`: `computeTestPerformance` returns graded
  entries ordered by date desc, treats `absent` rows as `percentage: null`,
  and returns `[]` for a student with no grades.

## Open Decisions (confirmed with user)

- Grading storage: migrated fully to Postgres (`test_grades`), Mongo
  `TestResult` retired. ✅
- Test-paper PDF: attach-only, never parsed into questions. ✅
- Student Reports integration: live/computed, not duplicated into
  `student_report_entries`. ✅
- Pre-existing `tests`/`questions` rows with no owner: visible to
  management only, hidden from every teacher. ✅
