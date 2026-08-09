# Student & Faculty Reports: Data Foundation + First Report Slice (Phase 1)

## Problem

Management asked for the full reporting suite described in "Reports for STUDENTS/PARENTS/SUBJECT TEACHERS/COORDINATORS/ACADEMIC HEAD/BUSINESS HEADS" (performance reports, test analysis, strength/weakness maps, error logs, rank tracking, teacher feedback, etc.). Almost every one of those reports is ultimately a rollup of student-level test performance, but that data doesn't exist at the required granularity today:

- **Grading is aggregate-only.** `TestGradingModal` has a teacher type four numbers (marks/correct/incorrect/unattempted) per student per test. There is no per-question response data, no link between a `test` and the `questions` that were on it, and `questions.correctAnswer` is never compared against anything — confirmed by code search, it's write-only.
- **Batch matching is unreliable.** `students.batch` and `tests.batch` are independently free-typed strings with no FK. Querying the real dev database, 0 of 348 tests had any student whose `batch` string matched — there is no structural guarantee two forms produce the same label, which makes any "percentile within batch" or "batch average" query meaningless as built.
- **Chapter/concept tagging doesn't exist.** `questions.topic` is free text, disconnected from the real `chapters` table (which is wired only into syllabus-progress tracking). No `concepts` table exists at all.
- **No percentile/rank calculation exists anywhere** — `progressReports.rank` is a hand-typed free-text field.
- **No mistake taxonomy, no daily behavioral ratings, no rank/segmentation benchmarks** exist in the schema — all needed for Error Logs, Teacher Feedback Summary, and Ranks/Student Segmentation reports.

Management has already modeled the missing data by hand in a spreadsheet (tabs: Chapters and Concepts, Test Performance, Faculty Daily Report, Faculty PTM Report, Standardization, Test Details, Error Analysis, Mistakes List, Corrective Measures List). This spec turns that spreadsheet model into real schema plus the first slice of reports it unlocks.

## Goals

1. Add real per-question response capture (which question, which student, correct/incorrect/unattempted), replacing manual aggregate-only grading.
2. Fix batch integrity so population-scoped queries (percentile, rank, batch average) are actually reliable.
3. Add curriculum structure (chapters get a `code`, new `concepts` table) so questions can be tagged by chapter/concept instead of free text.
4. Add the supporting reference data from the spreadsheet: rank/student-type benchmarks (Standardization), mistake categories + corrective measures (Error Analysis), and daily behavioral ratings (Faculty Daily Report).
5. Ship the first three reports end-to-end, staff-viewed, per student: **Performance Report**, **Test Analysis Report**, **Strength vs Weakness Map** — plus **Error Logs** and **Teacher Feedback Summary**, since the underlying capture (mistake tagging, daily ratings) is being built in this same pass.
6. All of this lives inside the existing `management` and `teacher` portals — no new login roles. Management sees school-wide data and can drill into any student; a teacher sees only their own batches' students (same ownership pattern already used for `tests.createdByUserId`/`questions.createdByUserId`).

## Non-goals

- No new login roles (student, parent, coordinator, academic head, business head) — confirmed staff-only for this phase.
- No time-spent-per-question capture — would require digital test-taking, not just grading entry.
- No literal answer-text capture in responses — the spreadsheet's own "Response Status" column is an enum (Correct/Incorrect/Unattempted), not the selected option, so that's all this phase stores. Full answer-choice capture is not built.
- No OMR/scanning integration — grading remains a manual per-question status grid, just replacing the current 4-number aggregate entry.
- No parent-formatted report output (PDF/print layout tuned for parents), no Improvement Tracker / Study Efficiency Report, no Coordinator/Academic Head/Business Head rollups (Faculty Performance Dashboard, Program Effectiveness, Rank Predictions, Faculty ROI, revenue/marketing correlation) — later phases; several of those need data (faculty CTC, marketing/campaign data) that doesn't exist anywhere in the schema and needs its own scoping.
- No retroactive backfill of existing `test_grades`/`questions` rows into the new per-question shape — existing graded tests keep their aggregate numbers as-is; the new capture applies going forward.
- Faculty PTM Report and the "Colour Codes" tab fields are not fully confirmed (management's screenshots didn't show them). `ptmReports` below is a best-guess shape based on the Faculty Daily Report tab's pattern; it will be adjusted once confirmed, without blocking the rest of this spec.

## Data model (Postgres, `lib/db/schema.ts`)

### Batch integrity fix

```ts
// students table: add
batchId: uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),

// tests table: add
batchId: uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),
```

Both existing free-text `batch` columns stay (avoids a breaking rename across every consumer) but the student form and the test-scheduling form switch from a free-text input to a `<select>` bound to `batches`, which sets both `batch` (label, kept in sync for display) and `batchId` (the real FK, used for every population query going forward). New queries (percentile, rank, batch average) join on `batchId`, never on the string.

### Curriculum: concepts + chapter code/board

```ts
// chapters table: add
code: varchar('code', { length: 50 }).notNull().default(''),
board: varchar('board', { length: 50 }), // CBSE | ICSE | ISC | null (not board-specific)

export const concepts = pgTable('concepts', {
  id: uuid('id').defaultRandom().primaryKey(),
  chapterId: uuid('chapter_id').notNull().references(() => chapters.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().default(''),
  orderIndex: integer('order_index').notNull().default(0),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

`chapters.subjectId`/`programId` already exist and cover the sheet's Class/Program/Subject facets (`batches.classLevel` already covers "Class"; `programs.type` already covers Foundation/JEE/NEET) — only `code`, `board`, and the new `concepts` child table are missing.

### Question bank: chapter/concept linkage, richer type, per-question marking scheme

```ts
export const questionTypeEnum = pgEnum('question_type', ['Single Correct', 'Multi Correct', 'Comprehension', 'Match'])

// questions table: add
chapterId: uuid('chapter_id').references(() => chapters.id, { onDelete: 'set null' }), // nullable: existing rows keep free-text `topic`
conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
unattemptedMarks: integer('unattempted_marks').notNull().default(0),
// `type` column's allowed values change from MCQ|Numerical|Integer|Subjective
// to questionTypeEnum's set, matching how this institute actually tags JEE/NEET questions.
// Existing `marks`/`negativeMarks` columns are kept and reused as
// correct-marks/incorrect-marks — no rename needed.
```

`topic` stays as-is (existing data, existing filter UI) — `chapterId`/`conceptId` are additive, populated for new questions going forward via a picker.

### Linking questions to a test, and capturing per-student responses

```ts
export const responseStatusEnum = pgEnum('response_status', ['Correct', 'Incorrect', 'Unattempted'])

export const testQuestions = pgTable('test_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull().default(0),
}, (table) => ({
  testQuestionUnique: uniqueIndex('test_questions_test_question_unique').on(table.testId, table.questionId),
}))

export const testQuestionResponses = pgTable('test_question_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  status: responseStatusEnum('status').notNull(),
  marksAwarded: integer('marks_awarded').notNull().default(0),
  gradedByUserId: uuid('graded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  responseUnique: uniqueIndex('test_question_responses_unique').on(table.testId, table.questionId, table.studentId),
}))
```

`test_grades` (existing table) is kept unchanged in shape but changes in *how it's populated*: instead of a teacher typing `marksObtained`/`correct`/`incorrect`/`unattempted` directly, those become a cache row computed by summing that student's `test_question_responses` for the test, written on grading save. Every existing reader of `test_grades` keeps working unmodified.

### Standardization: rank & student-type benchmarks

```ts
export const studentTypeEnum = pgEnum('student_type', ['Gifted', 'Fast Learners', 'Slow Learners'])

export const rankBenchmarks = pgTable('rank_benchmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }), // null = applies across subjects
  difficulty: varchar('difficulty', { length: 20 }).notNull(), // reuses questions.difficulty's Easy|Medium|Hard values
  minMarks: integer('min_marks').notNull(),
  maxMarks: integer('max_marks').notNull(),
  targetRank: varchar('target_rank', { length: 20 }).notNull(), // band label, e.g. "<10", "<50"
  studentType: studentTypeEnum('student_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

Admin-configured, school-wide. Used to classify a student (Gifted/Fast Learners/Slow Learners) and project a target rank band from their marks + the difficulty mix of what they attempted.

### Error taxonomy

```ts
export const mistakeCategories = pgTable('mistake_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(), // Conceptual | Mathematical | Silly | Time Management | ...
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const correctiveMeasures = pgTable('corrective_measures', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  mistakeCategoryId: uuid('mistake_category_id').references(() => mistakeCategories.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const errorLogs = pgTable('error_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  responseId: uuid('response_id').notNull().references(() => testQuestionResponses.id, { onDelete: 'cascade' }),
  mistakeCategoryId: uuid('mistake_category_id').notNull().references(() => mistakeCategories.id),
  correctiveMeasureId: uuid('corrective_measure_id').references(() => correctiveMeasures.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  responseUnique: uniqueIndex('error_logs_response_unique').on(table.responseId),
}))
```

An `error_logs` row only makes sense for a response whose `status = 'Incorrect'` — enforced in the API layer, not the DB (matches this codebase's existing convention of validating business rules in the query/route layer rather than DB constraints).

### Faculty Daily Report (behavioral ratings)

```ts
export const studentRatingEnum = pgEnum('student_rating', ['Unsatisfactory', 'Satisfactory', 'Good', 'Very Good', 'Excellent'])

export const dailyStudentRatings = pgTable('daily_student_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  facultyId: uuid('faculty_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
  batchId: uuid('batch_id').notNull().references(() => batches.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  attitude: studentRatingEnum('attitude').notNull(),
  behaviour: studentRatingEnum('behaviour').notNull(),
  focus: studentRatingEnum('focus').notNull(),
  interaction: studentRatingEnum('interaction').notNull(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentDateUnique: uniqueIndex('daily_student_ratings_student_date_unique').on(table.studentId, table.date),
}))
```

### Faculty PTM Report (best-guess shape — pending confirmation)

```ts
export const ptmReports = pgTable('ptm_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  facultyId: uuid('faculty_id').notNull().references(() => faculty.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  batchId: uuid('batch_id').references(() => batches.id, { onDelete: 'set null' }),
  date: varchar('date', { length: 10 }).notNull(),
  parentAttended: boolean('parent_attended').notNull().default(true),
  discussionNotes: text('discussion_notes').notNull().default(''),
  actionItems: text('action_items').notNull().default(''),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

## API changes

New query modules under `lib/db/queries/`:
- `curriculum.ts` — `concepts` CRUD, extends existing chapter queries with `code`/`board`.
- `rank-benchmarks.ts` — CRUD for `rankBenchmarks`; `classifyStudent(marks, difficulty, subjectId)` helper.
- `mistakes.ts` — CRUD for `mistakeCategories`/`correctiveMeasures`.
- `test-questions.ts` — attach/detach/list questions for a test.
- `test-responses.ts` — `saveResponses(testId, rows[])` (bulk upsert per student/question, then recomputes and upserts the corresponding `test_grades` cache row), `getResponseGrid(testId)` (roster × question matrix for the grading UI).
- `daily-ratings.ts`, `ptm-reports.ts`, `error-logs.ts` — straightforward CRUD, scoped by `facultyId`/`schoolId`.
- `reports.ts` — the actual report aggregations: `getPerformanceReport(studentId)` (scores, subject/chapter/concept-wise breakdown, percentile & rank within `batchId`), `getTestAnalysisReport(studentId, testId?)` (accuracy vs attempt ratio, question-type breakdown, difficulty breakdown), `getStrengthWeaknessMap(studentId)` (chapter/concept-level aggregate correctness), `getErrorLog(studentId)` (mistake category trend), `getTeacherFeedbackSummary(studentId)` (daily ratings rolled up).

New/changed route handlers under `app/api/`:
- `curriculum/chapters/route.ts` (extend existing), `curriculum/concepts/route.ts`
- `standardization/rank-benchmarks/route.ts`
- `mistakes/categories/route.ts`, `mistakes/corrective-measures/route.ts`
- `tests/[id]/questions/route.ts` — GET/POST the question set attached to a test
- `tests/[id]/responses/route.ts` — replaces the manual-number POST in `tests/[id]/grades/route.ts` with the per-question grid GET/POST; `grades/route.ts`'s GET stays as the read path (now backed by the computed cache) so nothing downstream breaks
- `daily-ratings/route.ts`, `ptm-reports/route.ts`, `error-logs/route.ts`
- `reports/students/[id]/performance/route.ts`, `.../test-analysis/route.ts`, `.../strength-weakness/route.ts`, `.../error-log/route.ts`, `.../teacher-feedback/route.ts`

All routes follow the existing role check (`management` sees any student/school-scoped data; `teacher` scoped to their own `batches`/`createdByUserId` ownership, same pattern as `tests/[id]/grades/route.ts` today).

## Frontend changes

**Admin-only configuration screens** (new left-nav entries under management):
- **Curriculum Manager** — CRUD tree for Class (existing `batches.classLevel`) → Program → Board → Subject → Chapter → Concept. No such picker UI exists today; `chapters` is currently invisible outside syllabus tracking.
- **Standardization Config** — manage `rankBenchmarks` rows (difficulty/marks band → target rank/student type).
- **Mistake & Corrective Measure Library** — manage the two lookup lists.

**Question bank** (`components/dashboard/teacher/TeacherTestsView.tsx` question form): add chapter/concept pickers (populated from Curriculum Manager data), update the question-type field to the new enum, add an "unattempted marks" input alongside existing marks/negative-marks.

**Test authoring**: new step/modal to attach question-bank questions to a test (currently a test has no question set at all) — `TestQuestionSetModal`.

**Grading, replacing `TestGradingModal`'s core**: instead of four number inputs per student row, render a grid — rows = roster students, columns = the test's attached questions — each cell a tap-cycle status control (Correct/Incorrect/Unattempted). Selecting Incorrect reveals an inline mistake-category picker (writes an `error_logs` row). Save computes and upserts the `test_grades` cache row per student, same as today's averageScore/status-flip behavior.

**Daily Student Rating entry** (teacher portal, new view): per-batch, per-day grid — one row per student, four rating dropdowns — modeled on the existing attendance-marking UX.

**PTM Report entry** (teacher portal, new view): simple per-student log form.

**Reports Hub extension** (`ManagementReportsHub.tsx` / `TeacherReportsHub.tsx`): new "Student Reports" tab, student search/picker, rendering Performance / Test Analysis / Strength-Weakness / Error Log / Teacher Feedback Summary as sub-sections on one `StudentReportDetailView` page — reuses the existing `ExportFormatModal` + `downloadTabularReportPDF` convention for CSV/PDF export, consistent with Student Roster/Fee/Attendance.

## Testing approach

- `lib/db/queries/test-responses.test.ts`: bulk save computes correct `test_grades` cache values; unique-constraint upsert behavior; percentile/rank computed against real `batchId`-scoped population (not string match).
- `lib/db/queries/reports.test.ts`: performance/test-analysis/strength-weakness/error-log/teacher-feedback aggregations against seeded fixture data, including a case with an incomplete/unmatched batch to confirm it's excluded correctly rather than silently mismatched.
- `lib/db/queries/rank-benchmarks.test.ts`, `mistakes.test.ts`, `curriculum.test.ts`, `daily-ratings.test.ts`, `ptm-reports.test.ts`: standard CRUD + role-scoping tests, following this repo's existing per-query-module test convention.
- Route-level tests for each new/changed endpoint: role scoping (management vs. teacher-owns-batch), validation (e.g. `error_logs` rejected for a `Correct`/`Unattempted` response).
- No automated frontend tests (no component-test infra in this project, consistent with every prior phase) — manual browser verification: attach questions to a test, grade via the new grid (including mistake tagging), confirm `test_grades` cache matches, enter daily ratings, enter a PTM log, then view all five report sections for a student from both the management and teacher portals, confirm scoping (a teacher can't see another teacher's students), and confirm CSV/PDF export.
