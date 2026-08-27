# Student Report Generation Engine + Server-Side PDF

## Problem

`generated_student_reports` / `report_subject_analytics` (migration `0044_master_curriculum_reports`) and their CRUD API (`/api/reports/generated[/[id]]`) already exist, and `ProgressReportView.tsx` lets staff hand-type a report per student (percentage, grade, attendance %, remarks) and export it via the browser's print dialog. That satisfies the "student report card" data model but not the actual ask in the technical requirements doc: **automated** generation that blends real test performance, attendance, and syllabus coverage, plus a real PDF artifact.

Separately, `app/api/reports/students/[id]/route.ts` already computes almost everything needed — marks/grade, batch rank/percentile, subject/chapter/concept mastery breakdown, strength/weakness lists — live, from real data (`testQuestionResponses`, `testGrades`, `dailyStudentRatings`, `ptmReports`), for the staff-only Reports Hub (Part 7). It was never wired to *persist* a snapshot into the new tables — this spec is that wiring, plus the two things it's still missing (attendance %, syllabus coverage %) and a server-rendered PDF.

## Goals

1. A `generateStudentReport(...)` engine call that computes a full report (marks, grade, rank, subject breakdown, coverage, attendance) for one student over an explicit date range and upserts it into `generated_student_reports` + `report_subject_analytics`.
2. A `generateBatchReports(...)` call that runs the above for every active student in a batch in one request ("one-click batch generation"), returning a per-student outcome summary.
3. A server-rendered PDF for a generated report, stored via the existing Vercel Blob pattern, with basic school branding (name, board, address, optional logo, optional principal signature).
4. UI actions in `ProgressReportView.tsx` to trigger single-student and whole-batch generation, and to download the rendered PDF once it exists.
5. Reuse the existing live-analytics computation rather than re-deriving it — extract it into a shared, date-range-aware function used by both the existing Reports Hub route and the new engine.

## Non-goals

- Parent email delivery. `pdfUrl` is produced and downloadable by staff; auto-emailing to `parents_guardians` is a separate future slice.
- Populating `batch_concept_progress` / `student_concept_progress`. Concept mastery in the report continues to be derived from test-response performance (`testQuestionResponses` joined to `chapters`/`concepts`), exactly as the existing live Hub does today. These two tables remain schema-only; nothing in this slice reads or writes them.
- A real `academic_terms` table. Term boundaries are supplied explicitly per generate call (`fromDate`/`toDate`), not looked up from a stored calendar. If recurring term windows become painful to retype, that's its own future slice.
- A settings-page uploader for the new school logo/signature fields. The schema fields ship in this slice (nullable, additive); wiring an upload UI for them is a small follow-up, not blocking.
- Any change to Question Bank or Test Creation surfaces (`app/api/questions`, `app/api/tests`) — explicitly deferred per the technical requirements doc, untouched here.
- Any change to `app/api/curriculum/*` — that surface (master curriculum CRUD/import/export) is already built and out of scope for this slice.

## Architecture

### 1. Shared analytics module — `lib/reports/student-analytics.ts`

Extract the computation currently inline in `app/api/reports/students/[id]/route.ts` (student lookup, per-question response fetch, batch grades/rank/percentile, subject/chapter/concept stats, strength/weakness categorization, daily-ratings/PTM aggregation) into:

```ts
export async function computeStudentAnalytics(
  studentId: string,
  schoolId: string | null,
  range?: { fromDate: string; toDate: string }, // YYYY-MM-DD, inclusive; omitted = all-time
): Promise<StudentAnalytics>
```

`range` filters the `testQuestionResponses`/`tests` join by `tests.date` and the `attendanceEntries`/`attendanceSessions` join by `attendanceSessions.date`. The existing route becomes a thin wrapper: `computeStudentAnalytics(studentId, schoolId)` (no range → today's all-time behavior, unchanged). This is a refactor, not a behavior change, for the live Hub — its existing tests must keep passing untouched.

Two computations are added here that don't exist anywhere today:
- **Attendance %**: `attendanceEntries` joined to `attendanceSessions`, scoped to the student's batch, `status = 'Present'` ÷ total sessions in range.
- **Syllabus coverage per subject**: `batchSyllabus` (chapter-level, already populated) joined to `chapters.subjectId`, scoped to the student's `batchId`: `completedChaptersCount` = rows with `status = 'Completed'`, `totalChaptersTaught` = all rows, per subject. (`conceptsMasteredCount`/`conceptsTotalCount` per subject continue to come from the existing concept-mastery stats, using the existing "mastered" threshold — mastery ≥ 75 — already used for the "strong topics" bucket.)

### 2. Generate engine — `lib/reports/generate-report.ts`

```ts
generateStudentReport({ studentId, schoolId, batchId, academicYear, term, fromDate, toDate, generatedBy })
  → { report, outcome: 'generated' | 'skipped', reason?: string }

generateBatchReports({ batchId, schoolId, academicYear, term, fromDate, toDate, generatedBy })
  → { results: Array<{ studentId, outcome: 'generated' | 'skipped' | 'failed', reason?: string }> }
```

`generateStudentReport` calls `computeStudentAnalytics(studentId, schoolId, { fromDate, toDate })`, maps the result onto `generatedStudentReports` fields (`overallPercentage`, `overallGrade`, `classRank`/`batchRank`, `attendancePercentage`, `syllabusCoveragePercentage`) and one `reportSubjectAnalytics` row per subject (`marksObtained`/`maxMarks`/`grade`, chapter/concept coverage counts).

**Upsert semantics**: look up an existing `generated_student_reports` row for `(studentId, academicYear, term)`.
- No existing row → insert.
- Existing row with `status = 'DRAFT'` → overwrite its computed fields in place (subject analytics rows replaced via delete-then-insert for that report, since the subject set can change between runs), `outcome: 'generated'`.
- Existing row with `status IN ('PUBLISHED', 'SENT_TO_PARENT')` → do not touch it, `outcome: 'skipped', reason: 'already <status>'`.

`strengthAreas`/`improvementAreas`/`teacherRemarks`/`principalRemarks` are **never overwritten** by generation once a row exists — those stay hand-authored via the existing PATCH endpoint, even on a re-generated DRAFT. Only the computed/aggregate fields (percentage, grade, rank, attendance, coverage, subject marks) get replaced.

`generateBatchReports` fetches all active students for the batch (same active-student query pattern used elsewhere for batch rosters) and calls `generateStudentReport` per student, catching per-student errors so one bad row doesn't fail the whole batch.

### 3. New API routes

- `POST /api/reports/generate` — body `{ studentId?: string, batchId?: string, academicYear: string, term: string, fromDate: string, toDate: string }`. Exactly one of `studentId`/`batchId` required. Calls the corresponding engine function, returns its result. Management/teacher auth, same session pattern as the other `/api/reports/*` routes.
- `POST /api/reports/generated/[id]/pdf` — loads the report + subject analytics (existing `getGeneratedReportById`), renders through a `@react-pdf/renderer` document component (`lib/reports/pdf/ReportCardDocument.tsx`), uploads the resulting buffer via the existing Vercel Blob `put()` call (same pattern as `app/api/tests/[id]/paper/route.ts`), sets `pdfUrl` on the report via `updateGeneratedReport`, returns `{ pdfUrl }`.

### 4. Schema addition

```ts
// schools table: add (additive, nullable)
logoUrl: text('logo_url'),
principalSignatureUrl: text('principal_signature_url'),
```

New migration file, no backfill. PDF template renders the school name/board/address (already populated) plus these two images when present; omits the image blocks when null.

### 5. UI — `ProgressReportView.tsx`

- Per-student card: a **Generate** button that opens a small date-range + academicYear/term prompt (reusing whatever the existing manual-create form already uses for those fields) and calls `POST /api/reports/generate` with `studentId`.
- Batch-level: a **Generate for Batch** action taking the same academicYear/term/date-range inputs once, calling `POST /api/reports/generate` with `batchId`, then showing the per-student `generated`/`skipped`/`failed` summary (e.g. "24 generated, 2 skipped — already published").
- Existing manual create/edit form is untouched — still how remarks get hand-edited on a report, generated or not.
- The existing "Export / Print Report Card PDF" button becomes conditional: if `pdfUrl` is set, show **Download PDF** (direct link to the blob); if not (report was hand-created and never generated/rendered, or is old), keep today's browser print-to-PDF as the fallback. No existing report loses its export path.

## Testing

Following this codebase's established pattern (`route.test.ts` against the real Neon dev DB, cleanup scoped by inserted IDs):

- `lib/reports/student-analytics.test.ts` — attendance % and syllabus-coverage math against fixture data, date-range filtering behavior, confirms the no-range call path is unchanged from today's live route output.
- `app/api/reports/generate/route.test.ts` — single-student generate (insert case, DRAFT-overwrite case, PUBLISHED-skip case), batch generate summary shape.
- `app/api/reports/generated/[id]/pdf/route.test.ts` — smoke test: 200 response, `application/pdf`-shaped output, `pdfUrl` persisted on the report row afterward. Not pixel-level PDF content verification.
- Existing `app/api/reports/students/[id]/route.test.ts` must keep passing unmodified — proof the extraction didn't change the live Hub's behavior.

## Implementation sequencing

Given the prior incident where a large multi-part feature was pushed and fully reverted in one shot, this ships as **two separate pushes**, not one:

**Push 1 — engine, no UI, no PDF.** Shared analytics extraction + `fromDate`/`toDate` support, generate engine + upsert semantics, `POST /api/reports/generate`, its tests, and confirmation the existing live Hub route's tests still pass unmodified. Verified against the real Neon dev DB before moving on.

**Push 2 — PDF + schema + UI.** `schools.logoUrl`/`principalSignatureUrl` migration, `@react-pdf/renderer` template, `POST /api/reports/generated/[id]/pdf`, and the `ProgressReportView.tsx` Generate/Generate-for-Batch/Download-PDF UI. Only starts once Push 1 is confirmed correct in the real app.

## Open items deferred to future slices

- Parent email delivery (`SENT_TO_PARENT` status already exists on the schema but nothing sets it via email today; would need to be set once an email actually goes out).
- School logo/signature upload UI.
- Any use of `batch_concept_progress` / `student_concept_progress`.
- A real academic-terms/calendar table, if manually retyping date ranges per generate call proves annoying in practice.
