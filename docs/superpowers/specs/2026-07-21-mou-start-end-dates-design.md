# MOU Start/End Dates Design

## Problem

`schools.mouStatus` is a free-text varchar (e.g. `"Active (2025)"`) edited independently in three different create/edit forms. There's no structured way to know when an MOU actually started or ends, and "active" is whatever text an admin happened to type.

## Goal

Replace the free-text MOU status with `mouStartDate` / `mouEndDate` fields. Active status is derived: no end date (or an end date in the future) means active; a past end date means expired. Apply this consistently everywhere MOU status is edited or displayed.

## Schema

`lib/db/schema.ts`, `schools` table:

- Remove: `mouStatus: varchar('mou_status', { length: 255 }).notNull().default('Active (2025)')`
- Add:
  - `mouStartDate: varchar('mou_start_date', { length: 10 })` — nullable, `YYYY-MM-DD`
  - `mouEndDate: varchar('mou_end_date', { length: 10 })` — nullable, `YYYY-MM-DD`

This mirrors the existing `varchar(10)` date convention already used for `students.dob`, `students.admissionDate`, and `batches.startDate`/`endDate` — no native Postgres `date` type is used elsewhere in this schema, so we don't introduce one here.

**Migration:** generate via `npm run db:generate` (drizzle-kit diff against the schema change above), apply via `npm run db:migrate`. Per the approved blank-slate decision, existing `mouStatus` text values are discarded — existing schools have `mouStartDate`/`mouEndDate` both `null` after migration, which computes to "Active" until an admin sets real dates.

## Status computation

New exported helper `formatMouStatus(startDate?: string | null, endDate?: string | null): string` in `components/dashboard/management/SchoolFormHelpers.tsx` (the existing shared home for school-form logic — already imported by every surface that touches MOU data):

- `endDate` empty/null → `"Active"`
- `endDate` present, `>= today` → `` `Active until ${formatted}` `` (e.g. `"Active until 31 Dec 2026"`)
- `endDate` present, `< today` → `` `Expired ${formatted}` `` (e.g. `"Expired 31 Dec 2025"`)

Date formatting: `new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })` → `"31 Dec 2026"`. Comparison against "today" uses the local date with time zeroed out, so an end date of today still counts as active.

`startDate` does not affect the computed label in this version — it's stored and editable but purely informational (not surfaced in the derived string). This can change later if needed; out of scope now.

## Surfaces to update

All three read `school.mouStatus` today and all three write it back; each becomes two date inputs plus a caption ("Leave End Date blank for an ongoing MOU"):

1. **`components/dashboard/management/SchoolsTab.tsx`** — the Edit School / Create School modals (the ones in the reported screenshot).
   - `SchoolEntry` type: `mouStatus: string` → `mouStartDate: string | null; mouEndDate: string | null`
   - `EMPTY_FORM`: `mouStatus: 'Active (2025)'` → `mouStartDate: '', mouEndDate: ''`
   - Create modal: MOU Status text input → Start Date / End Date date inputs
   - Edit modal: same swap; edit-click population reads `school.mouStartDate ?? ''` / `school.mouEndDate ?? ''`
   - School card's `MOU` row: `{school.mouStatus}` → `{formatMouStatus(school.mouStartDate, school.mouEndDate)}`

2. **`components/dashboard/management/SchoolDetailsModal.tsx`** (rendered by `InstitutionalDashboard.tsx`) — "School Background Details" modal.
   - `SchoolData` interface: `mouStatus: string` → `mouStartDate?: string | null; mouEndDate?: string | null`
   - Same text-input-to-date-inputs swap, styled with this file's own input classes (matches its existing look, not `SchoolsTab`'s)

3. **`components/dashboard/management/InstitutionalDashboard.tsx`**
   - `schoolData` state type: `mouStatus: string` → `mouStartDate: string | null; mouEndDate: string | null`
   - `initialData` fallback passed into `SchoolDetailsModal`: `mouStatus: ''` → `mouStartDate: '', mouEndDate: ''`
   - "MOU STATUS" summary tile: `schoolData?.mouStatus || 'Not set'` → `formatMouStatus(schoolData?.mouStartDate, schoolData?.mouEndDate)`

4. **`components/dashboard/management/OnboardingChoice.tsx`** — first-time Create School form (posts to `/api/admin/schools`, same as `SchoolsTab`'s create flow).
   - Same `mouStatus` text-input → Start Date / End Date swap, same form-state field rename

5. **`components/dashboard/teacher/TeacherDashboard.tsx`** — read-only MOU line.
   - `schoolData?.mouStatus || 'Not set'` → `formatMouStatus(schoolData?.mouStartDate, schoolData?.mouEndDate)`

## API routes

- **`app/api/admin/schools/route.ts`** (POST, create) — destructure `mouStartDate`, `mouEndDate` from the body instead of `mouStatus`; insert `mouStartDate: mouStartDate || null, mouEndDate: mouEndDate || null` (no more `'Active (2025)'` default).
- **`app/api/admin/schools/[id]/route.ts`** (PATCH, edit) — same field swap in the conditional `updates.*` assignment block.
- **`lib/db/queries/adminSchools.ts`** — the explicit select list swaps `mouStatus: schools.mouStatus` for `mouStartDate: schools.mouStartDate, mouEndDate: schools.mouEndDate`.
- **`app/api/schools/route.ts`** — dead code (no frontend caller references `/api/schools`), but directly reads/writes `mouStatus` on `schools`/`NewSchool` and will fail to typecheck once the column is removed. Same field swap applied here purely to keep it compiling; no new behavior, no caller to test against.
- **`app/api/school/route.ts`** + **`lib/db/queries/school.ts`** — no changes. `updateSchool(id, data: Partial<NewSchool>)` already passes through whatever fields are given; `GET` already returns the full row via `select()`. New fields flow through both automatically once the schema changes.

## Out of scope

- No validation that `mouEndDate` is after `mouStartDate`.
- No MOU history/audit log — only the current start/end pair is stored.
- `mouStartDate` is not part of the computed status string (informational only).
