# Student Roster Management UI: Edit/Delete/Add/CSV-Import Design

## Problem

The management Student Roster page (`components/dashboard/management/StudentRosterView.tsx`, served at `/management/students`) only lists students read-only. Its "Edit Profile" button is a placeholder that shows a toast instead of editing anything; there is no delete, no add-one-student flow, and no bulk CSV import — even though the backend (`/api/students`, `/api/students/bulk`) already supports all of this from the Student Roster Postgres migration. A separate, no-longer-rendered component (`StudentRoster.tsx`) had a working CSV import flow for `name`/`rollNo`/`class`/`section`/`parentContact`, but the live page never adopted it, and neither version has `program`/`batch` as real fields.

## Goals

1. Add `program` and `batch` as real, persisted, editable fields on the student record.
2. Let management edit and (soft-)delete a student from the roster page.
3. Let management add one student manually.
4. Let management bulk-import students from a CSV/Excel file, with a global Program/Batch/Section default that applies unless the file itself supplies a per-row value.

## Non-goals

- No change to the Teacher-side roster view or `/api/teacher-portal/students/[id]` in this round.
- No foreign-key relationship between a student's `program`/`batch` and the separate Mongo `Program` model (that model is dashboard-summary data in a different database; this round just adds two free-text fields on the student, matching how `class`/`section` already work).
- No hard-delete UI (the API's `permanent=true` flag stays unused by this UI; only soft-delete is exposed).
- No change to Attendance/Fees/Tests routes — they already source the `students` table independently and aren't affected by adding two new columns.

## Data model change

Add two columns to the `students` Postgres table (`lib/db/schema.ts`), in the same style as the existing `class`/`section` columns:

```ts
program: varchar('program', { length: 255 }).notNull().default(''),
batch: varchar('batch', { length: 255 }).notNull().default(''),
```

Drizzle migration generated via `npm run db:generate` + `npm run db:migrate`, same as every prior schema change in this project.

## API changes

- `POST /api/students`, `PATCH /api/students` (`app/api/students/route.ts`): accept and whitelist `program`/`batch` alongside the existing editable fields (`name`, `rollNo`, `class`, `section`, `parentContact`, `isActive`).
- `POST /api/students/bulk` (`app/api/students/bulk/route.ts`): request body gains an optional top-level `defaults: { program?: string; batch?: string; section?: string }`. For each parsed row, resolve `program`/`batch`/`section` as: `defaults.<field>` if non-empty, else the row's own `<field>` value parsed from the CSV, else `''`. (`name`, `rollNo`, `class`, `parentContact` are unaffected — they only ever come from the row.)
- `GET /api/students/roster` (`app/api/students/roster/route.ts`): stop hardcoding `batch: 'Unassigned'`; return `program: s.program || 'Unassigned'` and `batch: s.batch || 'Unassigned'` (preserving the existing "Unassigned" display fallback for genuinely empty values).

## Frontend changes (`components/dashboard/management/StudentRosterView.tsx`)

- **Header:** add "Add Student" and "Upload CSV" buttons next to the existing "Sync Data" button (which stays as-is — out of scope).
- **Add Student modal:** new component, form fields name/rollNo/class/section/program/batch/parentContact, submits to `POST /api/students`, refreshes the roster list and closes on success, shows inline validation error on failure (name required, mirroring the API's own validation).
- **Upload CSV modal:** new component, modeled on the parsing logic already proven in `components/dashboard/management/StudentRoster.tsx` (uses the existing `xlsx` dependency):
  - Three optional dropdowns at the top: Program, Batch, Section (populated from the current roster's distinct values, same pattern as the page's existing filter dropdowns, plus a free-text "Other" option).
  - A "Download Template" link producing an `.xlsx` with header row `Name, Roll No, Class, Section, Program, Batch, Parent Contact`.
  - A file picker (`.xlsx`, `.xls`, `.csv`, accept attribute set accordingly).
  - On file select: parse client-side with `xlsx`, show a preview table of the resolved rows (after applying the default-vs-CSV-column precedence so the user sees exactly what will be imported).
  - A "Confirm Import" button that posts `{ students: [...], defaults: { program, batch, section } }` to `POST /api/students/bulk`, then shows the `{ succeeded, failed, total }` result and refreshes the roster.
- **Table rows:** add a small Edit (pencil) and Delete (trash) icon button pair, visible on row hover, to the right of the existing columns. Edit opens the side drawer in edit mode (see below); Delete asks for confirmation, then calls `DELETE /api/students?id=<id>` (no `permanent` param — soft-delete only) and removes the row from the local list on success.
- **Side drawer:** the existing "Edit Profile" button currently calls `showToast('Opening edit modal...')` — replace with state toggling an inline edit form (reusing the same field set as the Add Student modal, pre-filled from `selectedStudent`), submitting via `PATCH /api/students?id=<id>`. Add a "Remove" button next to it (same soft-delete call as the row-level Delete action, closes the drawer on success).
- **Table column:** add a `Program` column next to the existing `Batch` column, both now reflecting the real persisted values (with the "Unassigned" fallback already applied server-side).
- **Edit form scope:** the edit form does NOT include an `isActive` toggle — reactivating a soft-deleted student is out of scope for this round. `isActive` stays exclusively controlled by the Delete action.
- **Inactive students must stay hidden after a refresh, not just optimistically removed.** `GET /api/students/roster` deliberately returns both active and inactive students (`listStudents({ activeOnly: false })`, preserved from the original Mongoose route's behavior) — it has no `isActive` field in the table UI today, so this was previously invisible. Once Delete exists, a soft-deleted student would otherwise silently reappear on the next page load. Fix: `fetchStudents()` in `StudentRosterView.tsx` filters the response to `data.filter(s => s.isActive !== false)` before storing it in state. This is a client-side filter, not an API change — `/api/students/roster`'s existing contract and its other consumer (the teacher-side roster view) are untouched.

## Testing approach

- `lib/db/queries/students.test.ts`: extend existing create/update tests to cover `program`/`batch` round-tripping (no new test file needed — these are just new columns on the same table).
- `app/api/students/route.test.ts`: extend POST/PATCH tests to assert `program`/`batch` are accepted and whitelisted.
- `app/api/students/bulk/route.test.ts`: add cases for the `defaults` precedence — defaults override CSV columns when set, CSV columns are used when defaults are omitted, both omitted leaves `''`.
- `app/api/students/roster/route.test.ts` (new — this route currently has no test file): add a test confirming `program`/`batch` are returned from real columns, falling back to `'Unassigned'` when empty.
- No new automated test for the modals/drawer UI itself (no existing frontend test infra in this project for React components) — manual verification in the browser is the plan, same as every prior phase of this migration effort.
