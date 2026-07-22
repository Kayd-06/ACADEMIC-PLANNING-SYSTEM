# Faculty CSV Import — Design

## Problem

Academic Planning (`AcademicPlanningView.tsx`, tabs: Schools / Programs / Batches / Syllabus Tracker) has no faculty section. Admins can only manage faculty one at a time via a separate page (Teacher Portal → "Faculty Directory"), which has manual add/edit forms and CSV *export* only — no bulk *import*.

The admin wants to bulk-upload a CSV/Excel sheet of faculty (including which batches each teacher is assigned to) directly from Academic Planning, with the same class of validation already built for the Student Roster CSV import (`docs/superpowers/specs/2026-07-20-csv-program-batch-validation-design.md`): a reference to a batch that doesn't exist in the system should be caught and reported per-row/per-field, not silently accepted or allowed to crash the import. Re-uploading the same or an updated sheet must not create duplicate faculty records — it should update existing ones and insert only genuinely new ones.

## Goals

- A new "Faculty" tab in Academic Planning showing the full faculty list for the admin's active school (name, employee ID, subject/specialization, assigned batches, status).
- An "Import CSV" button at the top of that tab, accepting `.csv`/`.xlsx`/`.xls`.
- The sheet carries standard faculty details plus a `Batches` column (comma-separated batch names) representing which batches that teacher is assigned to.
- Each batch name is validated against real `batches` records (scoped to the admin's active school); unmatched names are reported as a specific, actionable error without blocking the rest of the row.
- Re-importing the same sheet is idempotent: an existing faculty member (matched by Employee ID, falling back to Email) gets its changed fields updated and newly-listed batches added; it is never duplicated. A row that matches nothing existing is inserted as new.
- The underlying Neon Postgres tables (`faculty`, `teacher_batches`) are what the admin is managing — no new tables needed.

## Non-goals

- No edit/delete UI in the new Faculty tab — manual single-record management stays on the existing Teacher Portal → Faculty Directory page. The new tab is list + import only. (Confirmed with user: avoids duplicating a full CRUD form for a tab whose job is import/overview.)
- No "School" column in the CSV — every entity in this app (students, batches, programs, faculty) is already scoped to the admin's single active school (`getSchoolId(session)`); faculty import follows the same convention. Multi-school routing via CSV is out of scope and has no precedent anywhere else in the app.
- No "Class" validation — there is no Class entity for faculty (unlike Batch, which is a real table). The user's mention of "batch, class, school" was general phrasing; only Batch has a real reference to validate.
- No removal of existing batch assignments on re-import ("add-only", confirmed with user) — a batch assignment already in the database that the new sheet doesn't mention is left alone. Full sync/replace was explicitly rejected as riskier (could silently un-assign a teacher).
- No generalizing the existing `CsvUploadModal.tsx` into a shared student/faculty component (confirmed with user) — a new dedicated `FacultyCsvUploadModal.tsx` is built instead, keeping both modals simple and independently safe to change.
- No relaxing of `subject`/`specialization` as required fields — they are `NOT NULL` in the `faculty` table with no default and are marked required (`*`) on the existing manual "Add Faculty" form; CSV rows missing them are rejected with a field error, same contract as manual entry.

## Design

### 1. Data model — no schema changes

Existing tables already cover everything needed:

- `faculty` (`lib/db/schema.ts`) — has `employeeId` with a partial unique index on `(employeeId, schoolId)`, plus `email`, `name`, `subject`, `specialization` (both `NOT NULL`), and the rest of the manual-form fields (`dob`, `gender`, `phone`, `qualification`, `primaryStream`, `experienceYears`, `joiningDate`, `status`, etc.). It also has a legacy `batches` **integer count** column (not a relation) used elsewhere for dashboard metrics (e.g. `app/api/teacher-portal/dashboard/route.ts` sums it).
- `teacherBatches` — name-based junction table: `{ teacherId, batchName, subjectName, role, assignedAt }`. No uniqueness constraint on `(teacherId, batchName)` today; the bulk import enforces "don't insert a duplicate" in application code (see §3).
- `batches` — the real, school-scoped Batch entity table used for validation, same one the Program/Batch validation feature already validates against for students.

### 2. API endpoint — `app/api/teacher-portal/faculty/bulk/route.ts` (new)

Placed alongside the existing faculty route family (`app/api/teacher-portal/faculty/route.ts`, `.../faculty/[id]/assignments/route.ts`) rather than under `/api/faculty/`, keeping all faculty endpoints together.

```ts
interface FieldError {
  row: string
  field: 'name' | 'subject' | 'specialization' | 'batches' | 'general'
  value: string
  message: string
}
```

**Auth:** management role only (same guard as the existing `POST /api/teacher-portal/faculty` — no `teacher` role access, unlike student bulk import which allows both).

**Request body:** `{ faculty: any[] }` — parsed rows from the client (same client-parses-then-posts-JSON shape as `students/bulk`).

**Per-row processing** (`Promise.allSettled`, one entry per row, same pattern as `students/bulk/route.ts`):

1. **Required-field check.** `name`, `subject`, `specialization` must be non-empty (mirrors the manual form's required fields and the DB's `NOT NULL` columns with no default). Missing any → push a `FieldError` naming the missing field, skip the row entirely — this is the only case where the whole row is rejected.
2. **Batch validation (non-blocking).** Fetch this school's `batches` once before the row loop (`schoolId ? where(eq(batches.schoolId, schoolId)) : all`, same pattern as `programs`/`batches` routes elsewhere). Build a lowercase-name → batch map. Split the row's `Batches` cell on commas, trim each entry, look each up. Names with no match are collected into one `FieldError` (`field: 'batches'`, value = the joined list of bad names) — but this does **not** block the row: the faculty profile and any valid batch names in the same cell still get processed.
3. **Upsert matching**, in order:
   - `employeeId` present → look up existing `faculty` row by `(employeeId, schoolId)`.
   - No `employeeId`, `email` present → look up by `(email, schoolId)`.
   - Neither present → always insert new.
   - On insert, if a `23505` unique-violation is thrown (e.g. two rows in the same file share an Employee ID and raced), catch it and retry once as an update against the now-existing row — same defensive pattern the current manual `POST` handler already uses for this error code.
4. **Sparse update.** On a match, only fields present and non-empty in the row are written (mirrors the existing manual `PATCH` handler's `pickFields` behavior) — a thinner re-import sheet never blanks out previously-set data.
5. **Batch assignment (add-only).** For each *validated* batch name, insert a `teacherBatches` row only if one doesn't already exist for `(teacherId, batchName)` — skip silently if already present, never duplicate.
6. **Legacy count sync.** After the upsert, recompute `faculty.batches` (the integer count column) from the actual current count of that teacher's `teacherBatches` rows — not just this row's new names — so it stays correct regardless of add-only semantics and rows added by prior imports.

**Response:** `{ succeeded, failed, total, errors: FieldError[] }` — same shape convention as `students/bulk`. `failed` counts required-field rejections; batch-name problems are reported in `errors` but do not increment `failed` since the row still saves (only add a `failed` increment when the *entire* row was rejected).

### 3. Client upload modal — `components/dashboard/management/FacultyCsvUploadModal.tsx` (new)

A dedicated component, structurally following `CsvUploadModal.tsx`'s pattern (drag-drop zone, template download, client-side preview with per-cell error highlighting, post-import result panel) but with faculty-specific content throughout.

**Template columns:**

```
Name*, Employee ID, Email, Phone, Alt Phone, Date of Birth (YYYY-MM-DD), Gender,
Address Line 1, City, State, Pincode, Subject*, Specialization*, Qualification,
Primary Stream, Experience (Years), Joining Date (YYYY-MM-DD), Status, Batches, Bio, Profile Image URL
```

Header matching is case/spacing-insensitive via the same `get(['alias', ...])` lookup pattern already used in `CsvUploadModal.tsx`. `Batches` accepts comma-separated names, e.g. `"JEE Batch A, NEET Batch B"`.

**No default pickers.** Unlike the student modal (which has "Default Program"/"Default Batch" for sheets that are all one program/batch), faculty rows are inherently heterogeneous — different subjects, different batch sets per person. There's nothing sensible to default, so the modal has no `Defaults` state or `resolveField` merge step; every value comes from its own row.

**Client-side preview validation.** On mount, fetch `/api/batches` (already used elsewhere for the same purpose) and build the same lowercase lookup used server-side. After parsing, recompute per-row validation (`useMemo`, following the same shape as the existing `rowValidation` in `CsvUploadModal.tsx`): missing Name/Subject/Specialization and unmatched batch names are flagged with a red cell + message in the preview table, before the admin clicks Import.

**Preview table columns:** Name, Employee ID, Subject, Specialization, Batches (invalid names highlighted inline), Status.

**Result panel:** identical convention to the student modal — `succeeded`/`failed`/`total` plus a list of `errors[]`, one line per error (`Row: <label> — <message>`).

### 4. Faculty tab — `components/dashboard/management/FacultyTab.tsx` (new)

Added as the 5th entry in `AcademicPlanningView.tsx`'s tab array: `['Schools', 'Programs', 'Batches', 'Syllabus Tracker', 'Faculty']`. Follows the same `activeTab === tab` conditional-render pattern already used for the other four tabs.

Fetches `GET /api/teacher-portal/faculty` (already returns each faculty member joined with `batchAssignments`, `subjects`, `programAssignments` — no new read endpoint needed). Renders a table: Name, Employee ID, Subject/Specialization, Batches (as chips from `batchAssignments`), Status. "Import CSV" button top-right, opening `FacultyCsvUploadModal`, in the same position/style as the existing "New Program" button in the Programs tab. No edit/delete affordances — that remains the Teacher Portal page's responsibility.

## Testing

`app/api/teacher-portal/faculty/bulk/route.test.ts` (mirrors `app/api/students/bulk/route.test.ts`'s structure):

- Row missing `name`/`subject`/`specialization` → row skipped, `errors` contains a field error naming exactly which field is missing.
- Row with one valid and one unknown batch name in the same `Batches` cell → row still saves, `errors` contains a `field: 'batches'` entry naming only the unknown name, and the valid batch assignment is created.
- Re-importing a row with an existing Employee ID → existing faculty row's changed fields are updated, no duplicate `faculty` row is created.
- Re-importing a row whose batch name was already assigned to that teacher → no duplicate `teacher_batches` row.
- A row with no Employee ID but a matching existing Email → matched and updated by email.
- Two rows in the same file sharing an Employee ID → the second is applied as an update to the row the first one just created, not a failed insert.
- After import, `faculty.batches` (legacy count column) equals the real total count of that teacher's `teacher_batches` rows, including assignments from a prior import not mentioned in this sheet.
- Matching and batch validation are scoped by `schoolId` — a same-named batch belonging to a different school does not validate a match, and an Employee ID reused across schools does not cross-match.
- Non-management role (e.g. `teacher`) is rejected with 403.

`components/dashboard/management/FacultyCsvUploadModal.tsx` (if a test file exists / is added): `rowValidation` returns the expected error keys for a missing required field and an unmatched batch name, and returns `{}` for a fully valid row.
