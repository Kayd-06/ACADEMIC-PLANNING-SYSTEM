# CSV Program/Batch Validation & Section Removal — Design

## Problem

In the management Student Roster CSV import flow (`CsvUploadModal.tsx` → `POST /api/students/bulk`):

1. **`students.program` and `students.batch` are free-text columns with no validation against the real `programs`/`batches` entity tables.** A CSV `Program`/`Batch` cell (or a "Custom"/"Other" default value typed in the modal) is accepted as-is, even if it doesn't match any real `Program`/`Batch` record.
2. **The Student Roster's Program filter does an exact string match** (`s.program !== selectedProgramName` in `StudentRosterView.tsx`) against the *real* `Program.name` selected in the sidebar. A student imported with a free-text Program value that doesn't exactly match a real Program's name becomes invisible whenever the roster is scoped to that Program, while still showing up under "All Programs" — this is the reported bug (e.g. `"JEE Foundation for 9th"` imported with no default selected, real Program is named `"JEE"`).
3. **The official sample CSV template ships with fabricated Program names** (`'JEE Foundation for 9th'`, `'NEET Foundation for 9th'` in `downloadTemplate()`) that don't correspond to any real Program a school would have created — an admin following the template literally hits this bug immediately.
4. **The import has no field-level error reporting.** `POST /api/students/bulk` returns a generic `failedReasons: string[]` array; the modal shows one aggregate error string. There's no way for an admin to see *which* row and *which field* was wrong.
5. **"Section" is exposed as a filter and CSV concept but isn't a real entity.** No `sections` table exists; it's a free-text column on `students`. The Roster filter row and the CSV template/upload modal both surface it, adding noise the user wants removed. `section` is however still load-bearing internally: it's part of a DB-level unique index (`students_roll_no_class_section_school_unique`) and part of the `upsertStudentByNameClassSection` match-key fallback added in a prior fix — removing it from the data model would be a much larger, riskier change than what's being asked.

## Goals

- CSV rows (and modal defaults) with a Program or Batch value that doesn't match a real, school-scoped `Program`/`Batch` record are **not imported** — that specific row is skipped, not the whole file.
- The admin sees a clear, specific error per skipped row: which row, which field, what value was rejected, and what to do about it (fix the CSV or create the Program/Batch first).
- If both Program and Batch are given, the Batch must actually belong to that Program — catches a Batch name that's real but under the wrong Program.
- The admin gets this feedback as early as possible: the CSV preview highlights bad rows before the admin even clicks Import, not just after a failed round-trip.
- "Section" no longer appears in the Student Roster filter row or anywhere in the CSV upload modal (template download, preview table, default-value picker).
- The sample CSV template only ships example Program/Batch values that are safe (i.e., doesn't ship values that would fail the new validation).

## Non-goals

- No auto-creation of Program/Batch records from CSV values — admins must create them first via Academic Planning. (Confirmed with user.)
- No schema change to `students.section`, its unique index, or the `upsertStudentByNameClassSection` match-key logic — Section removal is UI/CSV-surface only. (Confirmed with user.)
- No validation of `Class` against any entity — there is no Class entity table, and the user's report was specifically about Program/Batch, not Class.
- No new API endpoint for pre-validation — the modal already fetches the full Program/Batch lists on mount (`realPrograms`/`realBatches`), so client-side preview validation reuses that, no extra round trip.
- No change to how the Batch *filter* on the Roster page works — it already derives its options from present student data (not from a mismatched external source), so it doesn't exhibit the reported bug.

## Design

### 1. Server-side validation (`app/api/students/bulk/route.ts`)

Before the per-row `Promise.allSettled` loop, fetch this school's Programs and Batches once and build case-insensitive lookup maps:

```ts
const schoolPrograms = schoolId
  ? await db.select().from(programs).where(eq(programs.schoolId, schoolId))
  : await db.select().from(programs)
const schoolBatches = schoolId
  ? await db.select().from(batches).where(eq(batches.schoolId, schoolId))
  : await db.select().from(batches)

const programByName = new Map(schoolPrograms.map(p => [p.name.trim().toLowerCase(), p]))
const batchByName = new Map(schoolBatches.map(b => [b.name.trim().toLowerCase(), b]))
```

(Matches the existing `schoolId ? filter : return all` pattern already used in `app/api/programs/route.ts` and `app/api/batches/route.ts`, rather than introducing `isNull` semantics not used elsewhere in the codebase.)

For each row, after resolving `program`/`batch` via `resolveField` (existing default-merge logic), validate before attempting any upsert:

```ts
type FieldError = { row: string; field: 'program' | 'batch'; value: string; message: string }

function validateProgramBatch(program: string, batch: string, rowLabel: string): FieldError | null {
  let matchedProgram: typeof schoolPrograms[number] | undefined
  if (program) {
    matchedProgram = programByName.get(program.toLowerCase())
    if (!matchedProgram) {
      return { row: rowLabel, field: 'program', value: program,
        message: `Program "${program}" does not exist. Create it first in Academic Planning, or fix the spelling.` }
    }
  }
  if (batch) {
    const matchedBatch = batchByName.get(batch.toLowerCase())
    if (!matchedBatch) {
      return { row: rowLabel, field: 'batch', value: batch,
        message: `Batch "${batch}" does not exist. Create it first in Academic Planning, or fix the spelling.` }
    }
    if (matchedProgram && matchedBatch.programId !== matchedProgram.id) {
      return { row: rowLabel, field: 'batch', value: batch,
        message: `Batch "${batch}" exists but belongs to a different Program, not "${program}".` }
    }
  }
  return null
}
```

`rowLabel` is `s.name.trim()` plus roll number if present (e.g. `"Amit Verma (Roll 103)"`), so the admin can locate the row in their spreadsheet.

Rows that fail validation are **not** passed to `upsertStudentBy…`/`createStudent` — they're recorded as a `FieldError` and skipped, same tier as a thrown exception in the existing `Promise.allSettled` results. Valid rows proceed exactly as today (upsert fallback chain, guardian upsert — unchanged).

Response shape changes from:
```ts
{ succeeded, failed, total, failedReasons: string[] }
```
to:
```ts
{ succeeded, failed, total, errors: FieldError[] }
```
`failed` counts both validation-skipped rows and any other thrown-exception failures (existing behavior); `errors` carries validation errors, other exceptions are still stringified into the same array shape (`{ row: rowLabel, field: 'general', value: '', message: string }`) so the client has one array to render regardless of failure cause.

### 2. Client-side preview validation (`CsvUploadModal.tsx`)

Reuse the already-fetched `realPrograms`/`realBatches` (currently only used to populate dropdown suggestions) to run the same check locally, immediately after parsing:

```ts
const programNames = new Set(realPrograms.map(p => p.name.trim().toLowerCase()))
const batchIndex = new Map(realBatches.map(b => [b.name.trim().toLowerCase(), b]))

function rowValidation(row: ParsedRow): { program?: string; batch?: string } {
  const program = resolveField(row.program, defaults.program)
  const batch = resolveField(row.batch, defaults.batch)
  const errors: { program?: string; batch?: string } = {}
  if (program && !programNames.has(program.toLowerCase())) {
    errors.program = `"${program}" doesn't exist — create it in Academic Planning first.`
  }
  if (batch) {
    const matched = batchIndex.get(batch.toLowerCase())
    if (!matched) errors.batch = `"${batch}" doesn't exist — create it in Academic Planning first.`
    else if (program && programNames.has(program.toLowerCase())) {
      const matchedProgram = realPrograms.find(p => p.name.trim().toLowerCase() === program.toLowerCase())
      if (matchedProgram && matched.programId !== matchedProgram.id) {
        errors.batch = `"${batch}" belongs to a different Program.`
      }
    }
  }
  return errors
}
```

This recomputes whenever `parsedRows` or `defaults` change (a `useMemo`, since defaults can change after parsing). The preview table's Program and Batch cells render a red border + the specific message beneath the value when that row has an error, so the admin sees problems before clicking Import — no round trip needed for this first pass.

The Import button remains enabled regardless of preview errors (partial import is the chosen behavior — the admin may want to import the valid rows now and fix the rest later). A small inline note above the table (visible only when `errors` is non-empty) states: *"N row(s) have a Program/Batch problem — see highlighted cells. These rows will be skipped on import."*

### 3. Post-import error reporting

After `handleImport` gets a response, the existing `result` panel (currently shows `succeeded`/`failed`/`total`) is extended to list `data.errors` when non-empty — one line per error: `Row: <rowLabel> — <message>`. This covers both rows the client already flagged and any the server additionally caught (e.g. if `realPrograms`/`realBatches` were stale in the client at parse time).

### 4. Section removal — Student Roster filter (`StudentRosterView.tsx`)

Remove:
- `sectionFilter` state and its `setSectionFilter` calls
- The `sections` derived array (`Array.from(new Set(students.map(s => s.rawSection)...))`)
- The `s.rawSection !== sectionFilter` clause in `filteredStudents`
- The "Section" `<select>` block in the filter row (between Class and Batch)

Class and Batch filter blocks are untouched; both sit in a `flex` row with `flex-1` each, so removing the middle block reflows automatically with no layout changes needed.

### 5. Section removal — CSV upload modal (`CsvUploadModal.tsx`)

Remove from the UI surface only:
- `'Section'` from `TEMPLATE_HEADERS` and from both example rows in `downloadTemplate()`
- `section` from the `Defaults` interface, `customField` state, and the `sectionOptions` derivation
- The `renderDefaultSelect('section', 'Default Section', sectionOptions)` call
- The `'Section'` column header and its `<td>` in the preview table

Keep unchanged (backward compat + existing match-key logic depends on these):
- `section` field on `ParsedRow` and its parser (`get(['section', 'div', 'division'])`) — so a CSV that still has a Section column (old template, or a school's own sheet) keeps working
- `section` handling in `app/api/students/bulk/route.ts` (`resolveField(s.section?.trim() || '', defaults?.section)`) — `defaults.section` will simply always be `undefined` from the client now, which `resolveField` already handles

### 6. Sample CSV template fix (`downloadTemplate()`)

Replace the fabricated example Program/Batch values (`'JEE Foundation for 9th'`, `'NEET Foundation for 9th'`, `'Batch A'`) with **empty strings** in both example rows. The template's job is to show the column shape, not to imply real values — shipping blanks means the template never fails its own validation, regardless of what Programs/Batches a given school has actually created.

## Testing

- `app/api/students/bulk/route.test.ts`:
  - Importing a row with a Program name that doesn't exist for the school → row is skipped, response `errors` contains a `field: 'program'` entry naming that row, `succeeded` excludes it.
  - Importing a row with a Batch name that doesn't exist → same, `field: 'batch'`.
  - Importing a row with a real Batch that belongs to a *different* Program than the row's Program → skipped with the mismatch message.
  - Importing a row with valid, matching Program+Batch → succeeds as today (upsert fallback chain unaffected).
  - Importing one valid row and one invalid row in the same request → `succeeded: 1`, `failed: 1`, valid row's student exists in the DB, invalid row's does not.
  - Program/Batch validation is scoped by `schoolId` — a Program that exists for a different school does not validate a match.
- `components/dashboard/management/CsvUploadModal.tsx` (if a test file exists / is added): `rowValidation` returns the expected error keys for an unmatched Program, an unmatched Batch, and a Batch/Program mismatch, and returns `{}` for a valid row.
