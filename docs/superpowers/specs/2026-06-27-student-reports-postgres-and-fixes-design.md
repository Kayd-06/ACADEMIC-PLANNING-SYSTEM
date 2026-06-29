# Student Reports & Analytics: Postgres Migration + Make It Fully Functional

## Problem

The Student Reports feature (management page at `/management/student-reports`, teacher page at `/teacher/student-reports`) is broken on both sides and still backed by MongoDB:

- **Teacher upload is broken.** `POST /api/teacher-portal/reports` saves a `StudentReport` document without `teacherId` and without `attendance` on each student entry — both fields are `required: true` on the Mongoose schema, so every save throws a validation error, surfaced to the user as "Upload Failed — Server rejected the report data."
- **The management dashboard's "real-looking" data is actually a hardcoded seed.** `GET /api/student-reports` auto-(re)inserts 15 fake reports (4 fixed students: Rahul Sharma, Priya Patel, Amit Verma, Sneha Reddy) per teacher whenever a teacher's report history doesn't include a "Finals" term report. Since the management dashboard (`GET /api/student-reports/dashboard`) reads across all teachers' reports, this seeded data is what actually renders. This is why "Priya Patel" appears multiple times in Top Performers at the same score.
- **The management page's filter buttons are fake.** Class/Section/Term/Subject are rendered as buttons, not `<select>` elements; each `onClick` resets the same state variable back to its own fixed default value and shows a toast — there is no actual filtering logic anywhere.
- **"View Details"** (on report rows, on both pages) and clicking a **Top Performer** name do nothing but show a toast.
- **"Download sample format"** (teacher upload modal) shows a toast instead of downloading anything.
- **Export** (management) shows a toast instead of exporting anything.
- There is no Postgres equivalent of `StudentReport` — it's pure Mongoose, unlike `users`, `schools`, `students`, and `counselingSessions`, which have all already been migrated to Drizzle/Neon.

## Goals

1. Migrate the report data model to Postgres (Drizzle), matching this project's established direction (see `models/Student.ts` migration as precedent).
2. Fix the teacher upload so it actually saves successfully.
3. Replace the hardcoded/seeded data with real queries over real uploaded reports.
4. Make every visible affordance on both pages actually work: filters, View Details, Top Performer click-through, Download sample format, Export.

## Non-goals

- No new pages beyond the two that already exist (no dedicated per-student report-card page).
- No delete UI for reports (neither page currently has a delete affordance for reports; not adding one).
- No cross-linking into the Student Roster's profile drawer — Top Performer click-through opens the report-detail modal (see below), not the roster's student profile.
- No `Section` filter — reports are uploaded per-Class only; the existing Section filter button is removed rather than wired to fake data (user-confirmed).
- No change to how Attendance is tracked elsewhere in the app (the separate Attendance feature/table is untouched) — `attendance` here is purely an optional per-report-entry field, same as the original Mongoose schema intended, just no longer mandatory.

## Data model (Postgres, `lib/db/schema.ts`)

Two new tables, replacing `models/StudentReport.ts` (which is deleted once migrated, same as `models/Student.ts` was):

```ts
export const studentReports = pgTable('student_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  teacherId: uuid('teacher_id').notNull().references(() => users.id),
  teacherName: varchar('teacher_name', { length: 255 }).notNull(),
  className: varchar('class_name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  term: varchar('term', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const studentReportEntries = pgTable('student_report_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id').notNull().references(() => studentReports.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
  marks: integer('marks').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  grade: varchar('grade', { length: 10 }).notNull(),
  attendance: integer('attendance'),
  remarks: varchar('remarks', { length: 1000 }),
})
```

Splitting "report" (upload metadata) from "entries" (one row per student) is what makes real filtering, aggregation, and dedup possible — the old model stored `students` as one big embedded array per report, which is why the dashboard route had to re-aggregate by iterating every report's array on every request.

`teacherId` is a real foreign key this time (both tables now live in the same Postgres database, unlike the Student↔Attendance cross-collection situation from the earlier migration).

## API changes

New query layer: `lib/db/queries/student-reports.ts` — typed functions: `listReports(filters)`, `getReportById(id)`, `createReport(data)`, `getDashboardData(filters)` (computes top performers, performance trends, attention subjects, and distinct filter-option values, all from real Postgres aggregates).

- **`app/api/teacher-portal/reports/route.ts`** (rewritten): `POST` derives `teacherId`/`teacherName` from the session (fixing the root-cause bug), accepts `attendance`/`remarks` as optional per-entry fields, persists via `createReport`. `GET` lists the current teacher's own reports.
- **`app/api/student-reports/route.ts`** (rewritten): `GET` lists reports — all of them for `management`, only the teacher's own for `teacher` — with no seeding side effect of any kind. `POST` removed (upload only happens through the teacher-portal route, removing the duplicate/diverging creation path).
- **`app/api/student-reports/dashboard/route.ts`** (rewritten): `GET` accepts optional `class`, `term`, `subject` query params for server-side filtering, and always returns the full distinct set of available class/term/subject values (so dropdowns show all options regardless of the current filter). Top performers are deduped by `(name, rollNo, className)`, keeping each student's single best-percentage entry and that entry's `reportId`, so the frontend can open the right report when a performer is clicked.
- **`app/api/student-reports/[id]/route.ts`** (rewritten): `GET` returns one report plus all its entries, for the View Details modal. Same role check as today (teachers can only view their own report).
- **`models/StudentReport.ts`** deleted once migrated.
- **`components/dashboard/management/StudentReportsAnalytics.tsx`** deleted — confirmed dead code, not referenced by any route.

## Frontend changes

**`components/dashboard/management/StudentReportsView.tsx`:**
- Class/Term/Subject become real `<select>` elements, populated from the dashboard response's distinct-values lists, defaulting to "All". Changing any of them re-fetches `/api/student-reports/dashboard` with the new query params. Section filter removed entirely.
- Clicking an Uploaded Reports row opens a new `ReportDetailModal` (fetches `GET /api/student-reports/[id]`, shows a table of every student entry: name, roll, marks/maxMarks, %, grade, remarks).
- Clicking a Top Performer opens the same `ReportDetailModal`, using the `reportId` already included in that performer's data.
- Export button generates a real `.xlsx` of the currently-filtered Uploaded Reports list (Teacher, Class, Subject, Term, Date, Student count), via the `xlsx` package already used elsewhere in this app.

**`components/dashboard/teacher/TeacherStudentReportsView.tsx`:**
- Upload now succeeds: payload includes `attendance`/`remarks` when present in the parsed file (optional CSV columns; absent → `null`), parser accepts header variants for them the same way Name/RollNo/Marks already do.
- "Download sample format" generates a real `.xlsx` template with headers `Name, RollNo, Marks, MaxMarks, Attendance, Remarks` plus 2–3 example rows.
- "View Details" on a Recent Reports row opens the same `ReportDetailModal` component (shared between both pages, since the underlying data shape is now identical).

**New shared component:** `components/dashboard/ReportDetailModal.tsx` (used by both management and teacher views) — props `{ reportId: string; onClose: () => void }`, fetches `GET /api/student-reports/[id]` itself, renders a read-only table of entries plus the report's own metadata (teacher, class, subject, term, date).

## Testing approach

- `lib/db/queries/student-reports.test.ts`: real-DB tests for `createReport`, `listReports` (role scoping), `getReportById`, `getDashboardData` (top-performer dedup logic, filter-by-class/term/subject, distinct-values lists, attention-subjects threshold).
- `app/api/teacher-portal/reports/route.test.ts`: POST succeeds with and without optional `attendance`/`remarks`; rejects missing required fields; GET scoped to session teacher.
- `app/api/student-reports/route.test.ts`: GET role-scoping (management sees all, teacher sees own); no seeding side effect (assert report count is exactly what was inserted, doesn't grow on repeated GETs).
- `app/api/student-reports/dashboard/route.test.ts`: filtering by each query param; dedup behavior with a student appearing in multiple reports; distinct-values lists are correct.
- `app/api/student-reports/[id]/route.test.ts`: returns entries; teacher forbidden from another teacher's report; management allowed.
- No automated frontend tests (no component test infra in this project, consistent with every prior phase) — manual browser verification of both pages: filters, View Details, Top Performer click-through, upload (with and without Attendance/Remarks columns), Download sample format, Export.
