# Automated Student Class Promotion — Design

## Problem

A student's grade level (`students.class`, e.g. `"9"`, `"10"`, `"11"`, `"12"`) is set once at admission and never changes automatically. Every academic year, management has to manually edit this field for every student in the school — infeasible at scale. We want class-level advancement to happen based on the school's academic-year cycle and each student's admission date, with human confirmation before anything is written, rather than silent bulk edits or fully manual per-student entry.

## Goals

- Detect, once per school per academic-year boundary, which students are due to move up a class level.
- Surface that as a reviewable preview (counts, not raw silent writes) with a notification to management.
- On explicit confirmation, apply the class bump, level up the student's batch to match, and record an audit trail.
- Never guess at outcomes the system can't know (pass/fail for Class 12, or for students already marked `Repeater`).

## Non-goals

- No automatic handling of Class 12 exit (graduation vs. repeat) — depends on board exam results, which this system has no way to know. Class 12 students are excluded from the automated run entirely; management continues to handle their status manually via the existing student edit flow.
- No moving a promoted student into a *different* batch. A batch is treated as a persistent cohort (its date range already spans multiple academic years in practice) — on confirmation, the student's existing batch has its own `classLevel` bumped to match instead of the student being reassigned elsewhere. If a batch holds a genuine mix of promoted and non-promoted students (e.g. a Repeater sharing a batch with promoted peers), the batch's `classLevel` still advances to reflect the promoted majority; management resolves any resulting mismatch manually via the existing student edit flow, same as other exclusions below.
- No support for non-standard class chains. The promotion chain is hardcoded as `9 → 10 → 11 → 12` (terminal), matching `CLASS_LEVELS` already used in `BatchesTab.tsx` / `app/api/batches/route.ts`. The free-text `schools.classes` field (e.g. `"Nursery – XII"`) is not parsed for this — it isn't structured reliably enough across schools, and this app's admissions/batches model is already built around 9–12.
- `Repeater`-class students are excluded from auto-promotion for the same reason as Class 12 — the system can't know they've cleared the year. They stay `Repeater` until staff manually changes their class.
- No per-student anniversary promotion — this is cohort-based (whole school moves together each cycle), per explicit product decision.

## Data model

### `schools.academicYearStartMonth`

New column: `integer, not null, default 4` (April — the common CBSE/Indian-board default already implied by `schools.board` defaulting to `"CBSE Affiliated"`). Editable in the existing **Schools tab** (`SchoolsTab.tsx`) alongside board/MOU dates, both in the create form and the edit modal.

### `class_promotion_runs`

One row per detected academic-year boundary for a school.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `schoolId` | uuid, fk `schools.id`, cascade | |
| `academicYear` | varchar | e.g. `"2027-2028"` |
| `boundaryDate` | varchar (date) | the cycle-start date that triggered this run |
| `status` | varchar | `'pending' \| 'confirmed' \| 'dismissed'` |
| `previewCounts` | jsonb | `{ "9": { "10": 42 }, "10": { "11": 38 }, "11": { "12": 15 } }` |
| `excludedNewAdmissionCount` | integer | students skipped for admission-date reasons |
| `excludedTerminalCount` | integer | Class 12 students, informational only |
| `confirmedAt` | timestamp, nullable | |
| `confirmedBy` | uuid, fk `users.id`, nullable | |
| `createdAt` | timestamp | |

Unique constraint on `(schoolId, academicYear)` — the idempotency guard that stops the daily cron from creating duplicate runs.

### `class_promotion_log`

One row per student actually promoted when a run is confirmed — the audit trail.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `runId` | uuid, fk `class_promotion_runs.id`, cascade | |
| `studentId` | uuid, fk `students.id`, cascade | |
| `fromClass` | varchar | |
| `toClass` | varchar | |
| `previousBatch` | varchar, nullable | batch the student was cleared from, for traceability |
| `createdAt` | timestamp | |

## Detection (scheduled check)

A Vercel Cron entry in `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/class-promotion", "schedule": "0 3 * * *" }] }
```

`GET /api/cron/class-promotion` runs daily. It:

1. Verifies the request via Vercel's standard cron auth (`Authorization: Bearer $CRON_SECRET`, checked against a `CRON_SECRET` env var) — rejects with 401 otherwise.
2. For each active school:
   - Compute this cycle's `boundaryDate` from `academicYearStartMonth` (the most recent `<month>-01` that is `<= today`).
   - Compute `academicYear` label from `boundaryDate` (e.g. boundary `2027-04-01` → `"2027-2028"`).
   - Skip if a `class_promotion_runs` row already exists for `(schoolId, academicYear)` (idempotent — safe to run daily without duplicating).
   - Otherwise, compute eligible students (see rule below), build `previewCounts` + excluded counts, insert a `pending` run, and insert a `notifications` row (existing table, category `"General"`, link to the new review tab) for every `management`-role user of that school.

### Eligibility rule

A student is eligible for promotion in this run if **all** of:

- `isActive = true`
- `class` is `'9'`, `'10'`, or `'11'` (has a defined next class; `'12'` and `'Repeater'` are always excluded)
- `admissionDate < previousBoundaryDate`, where `previousBoundaryDate = boundaryDate` minus one year (the start of the cycle that just ended)

Concretely: if the boundary just crossed is `2027-04-01`, `previousBoundaryDate` is `2026-04-01`. A student admitted anytime from `2026-04-01` onward (i.e., during the cycle that just finished, regardless of whether that was January or March) is **not** promoted this run — they're picked up automatically at the *next* boundary (`2028-04-01`), by which point they'll have completed a full academic year in their current class.

## Review & Confirm UI

New **"Promotion"** tab in `AcademicPlanningView.tsx`, alongside Schools / Programs / Batches / Syllabus Tracker / Faculty — management-only (matching the existing tab-visibility pattern in that file).

- If a `pending` run exists for the school, show it as a banner:
  - Table of `fromClass → toClass` counts (from `previewCounts`).
  - "`N` new admissions held to next year" (from `excludedNewAdmissionCount`).
  - "`N` Class 12 students excluded — handle manually" (from `excludedTerminalCount`).
  - **Confirm** and **Dismiss** buttons.
- Below the banner, a history list of past runs: academic year, date, total promoted, confirmed-by name, or "Dismissed".

### Confirm

`POST /api/academic-planning/promotions/[runId]/confirm` (management only, school-scoped):

1. Re-runs the eligibility query fresh (protects against data drift since detection — a student's admission date/class/active status could have changed).
2. In a single DB transaction, for each eligible student:
   - `UPDATE students SET class = <nextClass>` — the student's `batch` is left untouched; they stay enrolled where they were, and their `student_batch_enrollments` row (if any) stays `status = 'active'`.
   - Insert one `class_promotion_log` row (`fromClass`, `toClass`, `previousBatch`).
3. For each distinct batch that had at least one promoted student, `UPDATE batches SET classLevel = <nextClass>` once — the batch itself levels up alongside its cohort.
4. Update the run: `status = 'confirmed'`, `confirmedAt`, `confirmedBy`.
4. Return summary counts.

### Dismiss

`POST /api/academic-planning/promotions/[runId]/dismiss` — sets `status = 'dismissed'`. No student data is touched; the cycle is recorded as skipped in history.

## Testing

- Eligibility rule: unit tests around the boundary date (admitted exactly on `previousBoundaryDate`, one day before, one day after).
- Idempotency: calling the cron handler twice on the same day for the same school produces only one `pending` run.
- Confirm transaction: verifies class bump, batch classLevel bump, enrollment row stays `active`, and log rows, in one test each; verifies Class 12 / Repeater students are untouched.
- Confirm re-validates eligibility at confirm time, not just at detection time (test: a student deactivated between detection and confirm is excluded from the confirm).
