# Test Results CSV Import — Phase 1

## Problem

The "Student Reports Hub (5-in-1)" (`StudentFullReportsView.tsx`) shows Performance, Test Analysis, Strength vs Weakness, Error Logs, and Teacher Feedback for a student — but today this data only gets populated one student, one question, one day at a time, via `TestGradingModal` (per-question grading UI) and the daily-ratings/PTM entry screens. There is no bulk way to get a whole batch's test results and behavioral ratings into the system, so for most students the hub shows "0%, Rank #1, No subject data evaluated" — not because the feature is broken, but because nothing has populated the underlying tables for them yet.

Separately, there's an existing "Import report" CSV feature (`StudentReportImportModal.tsx`), but it only feeds a different, disconnected system — a flat `Name/RollNo/Marks/MaxMarks/Attendance/Remarks` table (`student_reports`/`student_report_entries`) that drives the "Uploaded Reports" tab, not the Hub. This is the confusion that prompted this feature: the "sample CSV" people were pointed at was never meant to feed the Hub at all.

Investigation into the current schema (`lib/db/schema.ts`) found that `tests`, `questions`, `testQuestionResponses`, `testGrades`, `dailyStudentRatings`, and `ptmReports` already carry every field the Hub needs — this was built out in an earlier phase (see [`2026-08-09-student-faculty-reports-foundation-design.md`](2026-08-09-student-faculty-reports-foundation-design.md)) and is fed today only through manual per-student UI. **No new tables or columns are needed.** This phase is entirely about a new bulk-import pathway into tables that already exist and already work.

Note on that earlier spec: it explicitly scoped out literal answer-text capture and auto-grading ("`questions.correctAnswer` is never compared against anything ... write-only"), treating that as future work. This phase picks that up — see Auto-grading below for how we make `correctAnswer` usable despite it being freely-typed, inconsistent text today.

## Goals (Phase 1)

- Admin selects an existing Test (with questions already defined in Test Bank), downloads a template shaped to that test's actual questions, fills in each student's answers, and uploads it.
- The system auto-grades each answer against the question's `correctAnswer`, and writes real `testQuestionResponses` + `testGrades` rows — the same tables `TestGradingModal` writes — so the Hub's Performance, Test Analysis, Strength vs Weakness, and Error Logs tabs light up immediately for every student in the sheet.
- The same sheet also carries per-student behavioral ratings (Attitude/Behaviour/Focus/Interaction) and optional PTM fields for that test date, writing to `dailyStudentRatings`/`ptmReports` — populating the Teacher Feedback tab too.
- Students not found in the test's batch are skipped (reported, not fatal). Re-uploading for a student+test that already has results overwrites them.

## Non-goals (Phase 1)

- **Not touching the old flat import or the "Uploaded Reports" tab in this phase.** The existing "Import report" button, `StudentReportImportModal.tsx`, and `student_reports`/`student_report_entries` stay exactly as they are and keep working. This phase adds a **new, separate** "Import Test Results" button inside the Hub. Retiring the old button/table and repointing "Uploaded Reports" charts to read from `testGrades` instead is **Phase 2**, done only after Phase 1 is shipped and verified — per the incremental-slice approach agreed with the user, given the prior revert on this same reports feature area.
- No literal-answer capture for Subjective questions — those remain manually gradable via `TestGradingModal`; the import's Subjective columns are informational only (ignored for auto-grading).
- No changes to Test Bank's question-authoring UI or to how `correctAnswer` is entered — the auto-grading logic works around its current free-text inconsistency rather than requiring a data migration.
- No retroactive backfill of existing tests — this only affects tests graded via this new import going forward.
- No new roles or permission model — same `teacher`/`management` gate as every other test-grading action.

## UI flow

New button, **"Import Test Results"**, placed in `StudentFullReportsView.tsx` / `StudentReportsView.tsx`'s Hub tab, next to Export. Opens `TestResultsImportModal.tsx`:

1. **Select test** — dropdown of tests visible to the admin (same authorization as `loadAuthorizedTest`), most recent first. Selecting a test fetches its attached questions (`listQuestionsForTest`) and roster (`findStudentsByBatchId` / `findStudentsByBatch` fallback — same `loadRoster` pattern already used in `app/api/tests/[id]/responses/route.ts`).
2. **Download template** — generates an `.xlsx` via SheetJS, one row per roster student (Name/RollNo pre-filled), column pairs per attached question in `orderIndex` order: `Q1_Answer`, `Q1_MistakeType`, `Q2_Answer`, `Q2_MistakeType`, ... followed by `Attitude`, `Behaviour`, `Focus`, `Interaction`, `PTM_ParentAttended`, `PTM_ParentName`, `PTM_DiscussionNotes`, `PTM_ActionItems`, `PTM_FollowUpDate`. An "Instructions" sheet documents: answer format per question (MCQ → letter A-D; Numerical/Integer → number; Subjective → not auto-graded, leave blank or use TestGradingModal), the 6 valid mistake-type values, the 5 valid rating values, and that all columns except Name/RollNo are optional per row.
3. **Upload filled sheet** — client parses and previews (row-limit 1000, file size 5MB, same caps as the existing importer), flags obvious issues before submit (unknown roll numbers, malformed answers) the same way `StudentReportImportModal`'s `validateRows` does today.
4. **Submit** — POSTs to `POST /api/tests/[id]/import-results`. Response reports per-row outcome: written, skipped (roll no not in roster), or error (with reason) — never a silent all-or-nothing failure.

## Auto-grading

New logic in `lib/reports/answer-grading.ts` (no existing equivalent — confirmed by code search), one function per question type:

- **MCQ**: CSV holds `A`/`B`/`C`/`D`. Map letter → `options[index]` (0-based). Compare against `correctAnswer`:
  1. Try extracting a letter from `correctAnswer` via pattern matching (`^\(?([A-D])\)?$`, `Option\s*([A-D])`, `Choice\s*([A-D])`, case-insensitive) — if found, compare directly to the CSV letter.
  2. Otherwise, compare `options[index]` against `correctAnswer` trimmed/case-insensitive (handles teachers who typed the option content into `correctAnswer` instead of a letter).
  3. If neither resolves (e.g. `correctAnswer` is empty or matches no option), the question is **unresolvable** — no response row is written for it for any student, and it's called out in the import summary ("Q3 has an unrecognized correct answer — fix it in Test Bank before results can be auto-graded") so the underlying Test Bank data quality issue is visible rather than silently mis-grading everyone.
- **Numerical/Integer**: parse both sides as numbers, compare within `0.01` epsilon; if either isn't numeric, fall back to trimmed/case-insensitive string match.
- **Subjective**: always skipped for auto-grading (see Non-goals).
- Blank/whitespace-only cell → `Unattempted`. Non-blank, no match → `Incorrect`. Match → `Correct`.

## Data writes (all via existing, already-tested functions — no new persistence logic beyond grading)

- Build a `{studentId, questionId, status, mistakeType}[]` array from the graded sheet, then call the **existing** `saveResponses()` (`lib/db/queries/test-responses.ts`) — the same function `TestGradingModal` already calls. This gets `marksAwarded` computation, the `testQuestionResponses` upsert (unique on `testId+questionId+studentId`), and the `testGrades` cache recompute for free, with identical behavior to manual grading.
- After `saveResponses()`, run the same test-status/averageScore/notify block that `POST /api/tests/[id]/responses` runs today (recompute `averageScore` from `testGrades`, flip `tests.status` to `Graded`, notify teacher/management) — extracted into a small shared helper both routes call, so the two grading paths can't drift.
- Ratings: build `SaveRatingInput[]` (skip a student entirely if all four rating cells are blank) and call the **existing** `saveDailyStudentRatings(batch, testDate, ratings, ...)` (`lib/db/queries/daily-ratings.ts`) — already upserts on `(studentId, date)`.
- PTM: for rows where `PTM_ParentAttended` or `PTM_DiscussionNotes` is non-blank, call the **existing** `savePtmReport()` (`lib/db/queries/ptm-reports.ts`). This is insert-only (matches its current behavior from the manual PTM screen) — re-uploading a sheet with the same PTM data again will add a second PTM entry, exactly as it would if a teacher logged the same PTM twice manually. Not a new limitation introduced by this feature.

## Duplicate / re-upload handling

- **Student matching**: by `RollNo` within the test's roster (`batchId` join preferred, `batch` string fallback — same as `loadRoster`). No match → row skipped, reported by roll number in the response summary.
- **Re-upload for an already-graded student+test**: `saveResponses()` already upserts on the existing unique index, so responses are overwritten with the new sheet's values — no special-casing needed, this is `saveResponses()`'s existing behavior.
- **Ratings**: overwritten via the existing `(studentId, date)` upsert.
- **PTM**: additive (see above) — accepted trade-off, not a regression from current behavior.

## Validation & permissions

- Role gate: `teacher`/`management`, active `schoolId` — same as every other test/grading route.
- Server re-validates independent of client: row count ≤1000, file ≤5MB, answer values are well-formed for their question's type, rating values are one of the 5 valid enum strings, mistake-type values are one of the 6 valid categories (reuse `MISTAKE_TYPES` from `TestGradingModal.tsx` as the single source of truth rather than duplicating the list).
- A row with a malformed cell doesn't fail the whole file — that one row (or just that one question column) is skipped/errored and reported, the rest of the import proceeds.

## Testing

- Unit tests for `lib/reports/answer-grading.ts`: MCQ letter-match, MCQ content-fallback-match, MCQ unresolvable case, numeric tolerance (`42` vs `42.0`), numeric fallback to string match, Subjective bypass, blank → Unattempted.
- Unit test confirming `marksAwarded` produced via this path matches what `TestGradingModal` would produce for identical graded statuses (since both go through `saveResponses()`, this is mostly a regression guard).
- Integration test on `POST /api/tests/[id]/import-results`: valid sheet → correct `testQuestionResponses`/`testGrades`/`dailyStudentRatings`/`ptmReports` writes and correct per-row summary; re-upload → overwrite confirmed; unknown roll no → skipped with reason in response; unresolvable question → flagged, no responses written for it; oversized file / row count → rejected with clear error.
- Manual check in the Hub UI: import a real test's results for a batch, confirm all of Performance, Test Analysis, Strength vs Weakness, Error Logs, and Teacher Feedback populate for those students.

## Phase 2 (future, separate spec)

- Repoint "Uploaded Reports" tab's trend chart / Top Performers / Needs Attention (`lib/db/queries/student-reports.ts`) to derive from `tests`/`testGrades` instead of `student_reports`/`student_report_entries`.
- Remove the old "Import report" button, `StudentReportImportModal.tsx`, `POST /api/student-reports/import`, and associated query functions.
- Historical data in `student_reports`/`student_report_entries` is not deleted or migrated in either phase — it simply stops receiving new data once Phase 2 removes the old import path.
