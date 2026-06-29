# Student Reports Postgres Migration + Functionality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Student Reports off Mongoose onto Postgres (Drizzle) and make every broken affordance on both the management and teacher Student Reports pages actually work against real data.

**Architecture:** Two new Drizzle tables (`student_reports` metadata + `student_report_entries` per-student rows) replace the `StudentReport` Mongoose model. A new query layer (`lib/db/queries/student-reports.ts`) backs four rewritten API routes. A new shared `ReportDetailModal` component is used by both the management and teacher pages to show a real per-student breakdown.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (`drizzle-orm/neon-http`), Neon serverless Postgres, Jest (real live Postgres DB, no DB-layer mocking), `xlsx` (already a dependency) for client-side template generation and export.

## Global Constraints

- No `Section` filter on the management page — reports are uploaded per-Class only; the existing Section filter button is removed, not wired to fake data.
- No new pages — only the two existing pages (`/management/student-reports`, `/teacher/student-reports`) are touched.
- No delete UI for reports — neither page has a delete affordance today; this plan doesn't add one.
- No seeding of fake/demo report data anywhere — the old seeding routine in `app/api/student-reports/route.ts` is removed entirely, not replicated.
- `attendance`/`remarks` are optional per-entry fields (nullable in the schema) — the upload form/CSV never requires them.
- Run `npm test` and `npm run build` after every task; both must stay clean.
- Commit after every task.

---

### Task 1: Add `student_reports` / `student_report_entries` tables to the schema

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/schema.test.ts`
- Create: `lib/db/migrations/0004_*.sql` (name chosen by `drizzle-kit generate`)

**Interfaces:**
- Produces: `studentReports`/`studentReportEntries` Drizzle tables and their `StudentReport`/`NewStudentReport`/`StudentReportEntry`/`NewStudentReportEntry` inferred types, imported by every later task from `../schema` (or `@/lib/db/schema`).

- [ ] **Step 1: Add the two tables**

In `lib/db/schema.ts`, change the import line at the top from:

```ts
import { pgTable, uuid, text, varchar, timestamp, pgEnum, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
```

to:

```ts
import { pgTable, uuid, text, varchar, timestamp, pgEnum, boolean, uniqueIndex, integer } from 'drizzle-orm/pg-core'
```

Then add this at the end of the file (after the `counselingSessions` table and its types):

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

export type StudentReport = typeof studentReports.$inferSelect
export type NewStudentReport = typeof studentReports.$inferInsert

export const studentReportEntries = pgTable('student_report_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => studentReports.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
  marks: integer('marks').notNull(),
  maxMarks: integer('max_marks').notNull().default(100),
  grade: varchar('grade', { length: 10 }).notNull(),
  attendance: integer('attendance'),
  remarks: varchar('remarks', { length: 1000 }),
})

export type StudentReportEntry = typeof studentReportEntries.$inferSelect
export type NewStudentReportEntry = typeof studentReportEntries.$inferInsert
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npm run db:generate`
Expected: a new file at `lib/db/migrations/0004_<name>.sql` containing `CREATE TABLE "student_reports" ...` and `CREATE TABLE "student_report_entries" ...` with a foreign key from `student_report_entries.report_id` to `student_reports.id` with `ON DELETE CASCADE`, and a foreign key from `student_reports.teacher_id` to `users.id`.

Run: `npm run db:migrate`
Expected: exits 0, reports the new migration applied.

- [ ] **Step 3: Update the generic schema test**

In `lib/db/schema.test.ts`, change:

```ts
import { db } from './index'
import { users, emailVerifications, schools, students } from './schema'

describe('schema', () => {
  it('can query all four tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(students)).resolves.toEqual(expect.any(Array))
  })
})
```

to:

```ts
import { db } from './index'
import { users, emailVerifications, schools, students, studentReports, studentReportEntries } from './schema'

describe('schema', () => {
  it('can query all tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(students)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReports)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReportEntries)).resolves.toEqual(expect.any(Array))
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/schema.test.ts lib/db/migrations
git commit -m "feat: add student_reports and student_report_entries tables"
```

---

### Task 2: Query layer — create, list, get-by-id

**Files:**
- Create: `lib/db/queries/student-reports.ts`
- Test: `lib/db/queries/student-reports.test.ts`

**Interfaces:**
- Consumes: `studentReports`/`studentReportEntries` tables (Task 1).
- Produces: `createReport(data: CreateReportInput): Promise<ReportWithEntries>`, `listReports(filters?: ListReportsFilters): Promise<StudentReportSummary[]>`, `getReportById(id: string): Promise<ReportWithEntries | null>`. Task 3 adds `getDashboardData` to this same file. Tasks 4-7 (routes) import all of these.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/student-reports.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '../index'
import { studentReports, studentReportEntries, users } from '../schema'
import { createReport, listReports, getReportById } from './student-reports'

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('student-reports queries', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('createReport inserts a report and its entries together', async () => {
    const teacher = await makeTeacher()
    const result = await createReport({
      teacherId: teacher.id,
      teacherName: teacher.name,
      className: 'Grade 10-A',
      subject: 'Physics',
      term: 'Mid-Term',
      entries: [
        { name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' },
        { name: 'Priya Patel', rollNo: '102', marks: 90, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Excellent' },
      ],
    })

    expect(result.className).toBe('Grade 10-A')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.find((e) => e.name === 'Priya Patel')?.attendance).toBe(98)
    expect(result.entries.find((e) => e.name === 'Rahul Sharma')?.attendance).toBeNull()
  })

  it('createReport handles an empty entries array without throwing', async () => {
    const teacher = await makeTeacher()
    const result = await createReport({
      teacherId: teacher.id,
      teacherName: teacher.name,
      className: 'Grade 10-A',
      subject: 'Physics',
      term: 'Mid-Term',
      entries: [],
    })
    expect(result.entries).toEqual([])
  })

  it('listReports returns all reports with their student counts when unfiltered', async () => {
    const teacher = await makeTeacher()
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
      entries: [{ name: 'A', rollNo: '1', marks: 50, maxMarks: 100, grade: 'C' }, { name: 'B', rollNo: '2', marks: 80, maxMarks: 100, grade: 'A' }],
    })
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals',
      entries: [{ name: 'C', rollNo: '3', marks: 60, maxMarks: 100, grade: 'B' }],
    })

    const reports = await listReports()
    expect(reports).toHaveLength(2)
    const physics = reports.find((r) => r.subject === 'Physics')
    expect(physics?.studentCount).toBe(2)
    const chem = reports.find((r) => r.subject === 'Chemistry')
    expect(chem?.studentCount).toBe(1)
  })

  it('listReports filters by teacherId, class, subject, and term', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await createReport({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term', entries: [] })
    await createReport({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals', entries: [] })

    const byTeacher = await listReports({ teacherId: teacherA.id })
    expect(byTeacher).toHaveLength(1)
    expect(byTeacher[0].subject).toBe('Physics')

    const byClass = await listReports({ class: 'Grade 11-B' })
    expect(byClass).toHaveLength(1)
    expect(byClass[0].subject).toBe('Chemistry')

    const bySubjectAndTerm = await listReports({ subject: 'Physics', term: 'Mid-Term' })
    expect(bySubjectAndTerm).toHaveLength(1)
  })

  it('getReportById returns the report with its entries, or null if missing', async () => {
    const teacher = await makeTeacher()
    const created = await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
      entries: [{ name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' }],
    })

    const fetched = await getReportById(created.id)
    expect(fetched?.entries).toHaveLength(1)
    expect(fetched?.entries[0].name).toBe('Rahul Sharma')

    expect(await getReportById('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/queries/student-reports.test.ts`
Expected: FAIL — `./student-reports` module does not exist yet.

- [ ] **Step 3: Implement the query functions**

Create `lib/db/queries/student-reports.ts`:

```ts
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  studentReports,
  studentReportEntries,
  type StudentReport,
  type StudentReportEntry,
} from '../schema'

export interface ReportEntryInput {
  name: string
  rollNo?: string
  marks: number
  maxMarks?: number
  grade: string
  attendance?: number | null
  remarks?: string | null
}

export interface CreateReportInput {
  teacherId: string
  teacherName: string
  className: string
  subject: string
  term: string
  entries: ReportEntryInput[]
}

export interface ReportWithEntries extends StudentReport {
  entries: StudentReportEntry[]
}

export interface ListReportsFilters {
  teacherId?: string
  class?: string
  subject?: string
  term?: string
}

export interface StudentReportSummary extends StudentReport {
  studentCount: number
}

export async function createReport(data: CreateReportInput): Promise<ReportWithEntries> {
  const [report] = await db
    .insert(studentReports)
    .values({
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      className: data.className,
      subject: data.subject,
      term: data.term,
    })
    .returning()

  if (data.entries.length === 0) {
    return { ...report, entries: [] }
  }

  const entries = await db
    .insert(studentReportEntries)
    .values(
      data.entries.map((e) => ({
        reportId: report.id,
        name: e.name,
        rollNo: e.rollNo ?? '',
        marks: e.marks,
        maxMarks: e.maxMarks ?? 100,
        grade: e.grade,
        attendance: e.attendance ?? null,
        remarks: e.remarks ?? null,
      }))
    )
    .returning()

  return { ...report, entries }
}

export async function listReports(filters: ListReportsFilters = {}): Promise<StudentReportSummary[]> {
  const conditions = []
  if (filters.teacherId) conditions.push(eq(studentReports.teacherId, filters.teacherId))
  if (filters.class) conditions.push(eq(studentReports.className, filters.class))
  if (filters.subject) conditions.push(eq(studentReports.subject, filters.subject))
  if (filters.term) conditions.push(eq(studentReports.term, filters.term))

  const baseQuery = db
    .select({
      id: studentReports.id,
      teacherId: studentReports.teacherId,
      teacherName: studentReports.teacherName,
      className: studentReports.className,
      subject: studentReports.subject,
      term: studentReports.term,
      createdAt: studentReports.createdAt,
      studentCount: sql<number>`count(${studentReportEntries.id})::int`,
    })
    .from(studentReports)
    .leftJoin(studentReportEntries, eq(studentReportEntries.reportId, studentReports.id))
    .groupBy(
      studentReports.id,
      studentReports.teacherId,
      studentReports.teacherName,
      studentReports.className,
      studentReports.subject,
      studentReports.term,
      studentReports.createdAt
    )
    .orderBy(studentReports.createdAt)

  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions))
  }
  return baseQuery
}

export async function getReportById(id: string): Promise<ReportWithEntries | null> {
  const rows = await db.select().from(studentReports).where(eq(studentReports.id, id))
  const report = rows[0]
  if (!report) return null
  const entries = await db.select().from(studentReportEntries).where(eq(studentReportEntries.reportId, id))
  return { ...report, entries }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/queries/student-reports.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/student-reports.ts lib/db/queries/student-reports.test.ts
git commit -m "feat: add student-reports query layer (create, list, get-by-id)"
```

---

### Task 3: Query layer — dashboard aggregation

**Files:**
- Modify: `lib/db/queries/student-reports.ts`
- Modify: `lib/db/queries/student-reports.test.ts`

**Interfaces:**
- Consumes: `createReport`, `studentReports`/`studentReportEntries` tables (Task 1, Task 2).
- Produces: `getDashboardData(filters?: DashboardFilters): Promise<DashboardData>`, where `DashboardData = { topPerformers: TopPerformerRow[]; performanceTrends: PerformanceTrendRow[]; attentionSubjects: AttentionSubjectRow[]; distinctClasses: string[]; distinctSubjects: string[]; distinctTerms: string[] }`. Task 6 (dashboard route) calls this directly.
- **Design note:** the old Mongoose-era code matched "Science" performance only against subjects literally containing the word "science" — which never matches real CBSE/JEE subjects like Physics/Chemistry/Biology, so that line of the chart was always 0 even before this migration. This task fixes that by also matching `physics`, `chemistry`, and `biology` — a deliberate behavior improvement, not an accidental one, since otherwise the chart's "Science" series remains permanently empty with any real-world subject names.

- [ ] **Step 1: Write the failing tests**

In `lib/db/queries/student-reports.test.ts`, add this import:

```ts
import { createReport, listReports, getReportById, getDashboardData } from './student-reports'
```

(replacing the existing import line of the same shape), then add this `describe` block at the end of the file:

```ts

describe('getDashboardData', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('dedupes top performers by name+rollNo+class, keeping their best score', async () => {
    const teacher = await makeTeacher()
    const report1 = await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Unit Test 1',
      entries: [{ name: 'Priya Patel', rollNo: '102', marks: 70, maxMarks: 100, grade: 'B' }],
    })
    const report2 = await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Mathematics', term: 'Finals',
      entries: [{ name: 'Priya Patel', rollNo: '102', marks: 95, maxMarks: 100, grade: 'A+' }],
    })

    const data = await getDashboardData()
    const priyaEntries = data.topPerformers.filter((p) => p.name === 'Priya Patel')
    expect(priyaEntries).toHaveLength(1)
    expect(priyaEntries[0].scorePercent).toBe(95)
    expect(priyaEntries[0].reportId).toBe(report2.id)
  })

  it('returns at most 5 top performers, sorted descending by score', async () => {
    const teacher = await makeTeacher()
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals',
      entries: [
        { name: 'A', rollNo: '1', marks: 50, maxMarks: 100, grade: 'C' },
        { name: 'B', rollNo: '2', marks: 60, maxMarks: 100, grade: 'C' },
        { name: 'C', rollNo: '3', marks: 70, maxMarks: 100, grade: 'B' },
        { name: 'D', rollNo: '4', marks: 80, maxMarks: 100, grade: 'A' },
        { name: 'E', rollNo: '5', marks: 90, maxMarks: 100, grade: 'A' },
        { name: 'F', rollNo: '6', marks: 99, maxMarks: 100, grade: 'A+' },
      ],
    })

    const data = await getDashboardData()
    expect(data.topPerformers).toHaveLength(5)
    expect(data.topPerformers[0].name).toBe('F')
    expect(data.topPerformers[0].scorePercent).toBe(99)
  })

  it('computes math and science performance trends per term, matching physics/chemistry/biology as science', async () => {
    const teacher = await makeTeacher()
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Mathematics', term: 'Finals',
      entries: [{ name: 'A', rollNo: '1', marks: 80, maxMarks: 100, grade: 'A' }],
    })
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals',
      entries: [{ name: 'A', rollNo: '1', marks: 60, maxMarks: 100, grade: 'B' }],
    })

    const data = await getDashboardData()
    const finals = data.performanceTrends.find((t) => t.term === 'Finals')
    expect(finals?.math).toBe(80)
    expect(finals?.science).toBe(60)
  })

  it('flags subjects with an average below 65% as needing attention', async () => {
    const teacher = await makeTeacher()
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Chemistry', term: 'Finals',
      entries: [
        { name: 'A', rollNo: '1', marks: 50, maxMarks: 100, grade: 'C' },
        { name: 'B', rollNo: '2', marks: 60, maxMarks: 100, grade: 'C' },
      ],
    })
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Mathematics', term: 'Finals',
      entries: [{ name: 'A', rollNo: '1', marks: 90, maxMarks: 100, grade: 'A' }],
    })

    const data = await getDashboardData()
    expect(data.attentionSubjects.map((s) => s.subject)).toEqual(['Chemistry'])
    expect(data.attentionSubjects[0].avgPercent).toBe(55)
  })

  it('filters all aggregates by teacherId, class, subject, and term', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await createReport({
      teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals',
      entries: [{ name: 'A', rollNo: '1', marks: 80, maxMarks: 100, grade: 'A' }],
    })
    await createReport({
      teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1',
      entries: [{ name: 'B', rollNo: '2', marks: 40, maxMarks: 100, grade: 'D' }],
    })

    const scopedToTeacherA = await getDashboardData({ teacherId: teacherA.id })
    expect(scopedToTeacherA.topPerformers).toHaveLength(1)
    expect(scopedToTeacherA.topPerformers[0].name).toBe('A')

    const scopedToClass = await getDashboardData({ class: 'Grade 11-B' })
    expect(scopedToClass.topPerformers).toHaveLength(1)
    expect(scopedToClass.topPerformers[0].name).toBe('B')
  })

  it('returns distinct class/subject/term values scoped by teacherId only, not by the other filters', async () => {
    const teacher = await makeTeacher()
    await createReport({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals', entries: [] })
    await createReport({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1', entries: [] })

    const data = await getDashboardData({ class: 'Grade 10-A' })
    expect(data.distinctClasses.sort()).toEqual(['Grade 10-A', 'Grade 11-B'])
    expect(data.distinctSubjects.sort()).toEqual(['Chemistry', 'Physics'])
    expect(data.distinctTerms.sort()).toEqual(['Finals', 'Unit Test 1'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/queries/student-reports.test.ts`
Expected: FAIL — `getDashboardData` is not exported yet.

- [ ] **Step 3: Implement `getDashboardData`**

Append this to `lib/db/queries/student-reports.ts`:

```ts

export interface DashboardFilters {
  teacherId?: string
  class?: string
  subject?: string
  term?: string
}

export interface TopPerformerRow {
  name: string
  rollNo: string
  className: string
  scorePercent: number
  reportId: string
}

export interface PerformanceTrendRow {
  term: string
  math: number
  science: number
}

export interface AttentionSubjectRow {
  subject: string
  avgPercent: number
}

export interface DashboardData {
  topPerformers: TopPerformerRow[]
  performanceTrends: PerformanceTrendRow[]
  attentionSubjects: AttentionSubjectRow[]
  distinctClasses: string[]
  distinctSubjects: string[]
  distinctTerms: string[]
}

interface ScopedEntryRow {
  reportId: string
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  className: string
  subject: string
  term: string
}

async function getScopedEntries(filters: DashboardFilters): Promise<ScopedEntryRow[]> {
  const conditions = []
  if (filters.teacherId) conditions.push(eq(studentReports.teacherId, filters.teacherId))
  if (filters.class) conditions.push(eq(studentReports.className, filters.class))
  if (filters.subject) conditions.push(eq(studentReports.subject, filters.subject))
  if (filters.term) conditions.push(eq(studentReports.term, filters.term))

  const baseQuery = db
    .select({
      reportId: studentReportEntries.reportId,
      name: studentReportEntries.name,
      rollNo: studentReportEntries.rollNo,
      marks: studentReportEntries.marks,
      maxMarks: studentReportEntries.maxMarks,
      className: studentReports.className,
      subject: studentReports.subject,
      term: studentReports.term,
    })
    .from(studentReportEntries)
    .innerJoin(studentReports, eq(studentReports.id, studentReportEntries.reportId))

  if (conditions.length > 0) {
    return baseQuery.where(and(...conditions))
  }
  return baseQuery
}

function percentOf(entry: { marks: number; maxMarks: number }): number {
  return entry.maxMarks > 0 ? (entry.marks / entry.maxMarks) * 100 : 0
}

function isScienceSubject(subject: string): boolean {
  const s = subject.toLowerCase()
  return s.includes('science') || s.includes('physics') || s.includes('chemistry') || s.includes('biology')
}

export async function getDashboardData(filters: DashboardFilters = {}): Promise<DashboardData> {
  const entries = await getScopedEntries(filters)

  const bestByStudent = new Map<string, TopPerformerRow>()
  for (const e of entries) {
    const percent = percentOf(e)
    const key = `${e.name}|${e.rollNo}|${e.className}`
    const existing = bestByStudent.get(key)
    if (!existing || percent > existing.scorePercent) {
      bestByStudent.set(key, { name: e.name, rollNo: e.rollNo, className: e.className, scorePercent: percent, reportId: e.reportId })
    }
  }
  const topPerformers = Array.from(bestByStudent.values())
    .sort((a, b) => b.scorePercent - a.scorePercent)
    .slice(0, 5)

  const termStats: Record<string, { mathTotal: number; mathCount: number; sciTotal: number; sciCount: number }> = {}
  for (const e of entries) {
    if (!termStats[e.term]) termStats[e.term] = { mathTotal: 0, mathCount: 0, sciTotal: 0, sciCount: 0 }
    const percent = percentOf(e)
    if (e.subject.toLowerCase().includes('math')) {
      termStats[e.term].mathTotal += percent
      termStats[e.term].mathCount += 1
    } else if (isScienceSubject(e.subject)) {
      termStats[e.term].sciTotal += percent
      termStats[e.term].sciCount += 1
    }
  }
  const performanceTrends = Object.keys(termStats)
    .sort()
    .map((term) => {
      const s = termStats[term]
      return {
        term,
        math: s.mathCount > 0 ? Math.round(s.mathTotal / s.mathCount) : 0,
        science: s.sciCount > 0 ? Math.round(s.sciTotal / s.sciCount) : 0,
      }
    })

  const subjectStats: Record<string, { total: number; count: number }> = {}
  for (const e of entries) {
    if (!subjectStats[e.subject]) subjectStats[e.subject] = { total: 0, count: 0 }
    subjectStats[e.subject].total += percentOf(e)
    subjectStats[e.subject].count += 1
  }
  const attentionSubjects = Object.keys(subjectStats)
    .map((subject) => ({ subject, avgPercent: subjectStats[subject].total / subjectStats[subject].count }))
    .filter((s) => s.avgPercent < 65)

  const scopeConditions = []
  if (filters.teacherId) scopeConditions.push(eq(studentReports.teacherId, filters.teacherId))
  const distinctValuesQuery = db
    .select({ className: studentReports.className, subject: studentReports.subject, term: studentReports.term })
    .from(studentReports)
  const allReports =
    scopeConditions.length > 0 ? await distinctValuesQuery.where(and(...scopeConditions)) : await distinctValuesQuery

  return {
    topPerformers,
    performanceTrends,
    attentionSubjects,
    distinctClasses: Array.from(new Set(allReports.map((r) => r.className))).sort(),
    distinctSubjects: Array.from(new Set(allReports.map((r) => r.subject))).sort(),
    distinctTerms: Array.from(new Set(allReports.map((r) => r.term))).sort(),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/queries/student-reports.test.ts`
Expected: PASS (12 tests — 6 from Task 2 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/student-reports.ts lib/db/queries/student-reports.test.ts
git commit -m "feat: add dashboard aggregation (top performers, trends, attention subjects)"
```

---

### Task 4: Fix `/api/teacher-portal/reports` (the actual upload bug)

**Files:**
- Modify: `app/api/teacher-portal/reports/route.ts` (full replacement)
- Create: `app/api/teacher-portal/reports/route.test.ts` (this route currently has no test file)

**Interfaces:**
- Consumes: `createReport`, `listReports`, `getReportById` (Task 2).
- Produces: no new exports — this is the route the teacher upload modal (Task 10) posts to. `GET` response shape: `Array<{ _id, class, sub, term, students, avg, date }>` (unchanged shape from before, so Task 10 needs minimal frontend changes). `POST` accepts `{ className, subject, term, students: Array<{name, rollNo?, marks, maxMarks?, grade, attendance?, remarks?}> }`.

- [ ] **Step 1: Write the failing tests**

Create `app/api/teacher-portal/reports/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('POST /api/teacher-portal/reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(401)
  })

  it('rejects non-teacher roles', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'x', role: 'management' } })
    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({ className: 'A', subject: 'B', term: 'C', students: [{ name: 'X', marks: 1, grade: 'A' }] }) }))
    expect(res.status).toBe(403)
  })

  it('saves a report with the session teacherId, without requiring attendance', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    const res = await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A',
          subject: 'Physics',
          term: 'Mid-Term',
          students: [{ name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' }],
        }),
      })
    )
    expect(res.status).toBe(201)

    const reports = await db.select().from(studentReports)
    expect(reports).toHaveLength(1)
    expect(reports[0].teacherId).toBe(teacher.id)

    const entries = await db.select().from(studentReportEntries)
    expect(entries).toHaveLength(1)
    expect(entries[0].attendance).toBeNull()
  })

  it('saves attendance and remarks when the payload includes them', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A',
          subject: 'Physics',
          term: 'Mid-Term',
          students: [{ name: 'Priya Patel', rollNo: '102', marks: 90, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Excellent' }],
        }),
      })
    )

    const entries = await db.select().from(studentReportEntries)
    expect(entries[0].attendance).toBe(98)
    expect(entries[0].remarks).toBe('Excellent')
  })

  it('rejects when required fields are missing', async () => {
    const teacher = await makeTeacher()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, name: teacher.name, role: 'teacher' } })

    const res = await POST(req('http://localhost/api/teacher-portal/reports', { method: 'POST', body: JSON.stringify({ className: 'A' }) }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/teacher-portal/reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('returns only the current teacher own reports, with computed average score', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, name: teacherA.name, role: 'teacher' } })

    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({
          className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
          students: [
            { name: 'A', rollNo: '1', marks: 80, maxMarks: 100, grade: 'A' },
            { name: 'B', rollNo: '2', marks: 60, maxMarks: 100, grade: 'B' },
          ],
        }),
      })
    )
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherB.id, name: teacherB.name, role: 'teacher' } })
    await POST(
      req('http://localhost/api/teacher-portal/reports', {
        method: 'POST',
        body: JSON.stringify({ className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals', students: [{ name: 'C', rollNo: '3', marks: 40, maxMarks: 100, grade: 'D' }] }),
      })
    )

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, name: teacherA.name, role: 'teacher' } })
    const res = await GET()
    const body = await res.json()

    expect(body).toHaveLength(1)
    expect(body[0].class).toBe('Grade 10-A')
    expect(body[0].students).toBe(2)
    expect(body[0].avg).toBe('70%')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/teacher-portal/reports/route.test.ts`
Expected: FAIL — the current route still uses the Mongoose `StudentReport` model and `connectDB`, not the new query layer.

- [ ] **Step 3: Replace the route**

Replace `app/api/teacher-portal/reports/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createReport, listReports, getReportById } from '@/lib/db/queries/student-reports'

export const dynamic = 'force-dynamic'

interface IncomingEntry {
  name: string
  rollNo?: string
  marks: number
  maxMarks?: number
  grade: string
  attendance?: number | null
  remarks?: string | null
}

// GET — the current teacher's own reports, for the "Recent Reports" table
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const summaries = await listReports({ teacherId: session.user.id })
    const detailed = await Promise.all(summaries.map((s) => getReportById(s.id)))

    const formatted = summaries.map((s, idx) => {
      const entries = detailed[idx]?.entries ?? []
      let totalMarks = 0
      let totalMax = 0
      entries.forEach((e) => {
        totalMarks += e.marks
        totalMax += e.maxMarks
      })
      const avgScore = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0

      return {
        _id: s.id,
        class: s.className,
        sub: s.subject,
        term: s.term,
        students: s.studentCount,
        avg: `${avgScore}%`,
        date: new Date(s.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      }
    })

    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — upload a grading sheet (teacher only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can upload reports' }, { status: 403 })
    }

    const body = await req.json()
    const { className, subject, term, students } = body as {
      className: string
      subject: string
      term: string
      students: IncomingEntry[]
    }

    if (!className || !subject || !term || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or student data' }, { status: 400 })
    }

    const report = await createReport({
      teacherId: session.user.id,
      teacherName: session.user.name ?? 'Faculty',
      className,
      subject,
      term,
      entries: students.map((s) => ({
        name: s.name,
        rollNo: s.rollNo ?? '',
        marks: s.marks,
        maxMarks: s.maxMarks ?? 100,
        grade: s.grade,
        attendance: s.attendance ?? null,
        remarks: s.remarks ?? null,
      })),
    })

    return NextResponse.json({ success: true, report }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/teacher-portal/reports/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/teacher-portal/reports/route.ts app/api/teacher-portal/reports/route.test.ts
git commit -m "fix: set teacherId and make attendance optional on report upload"
```

---

### Task 5: Fix `/api/student-reports` — role-scoped, real data, no seeding

**Files:**
- Modify: `app/api/student-reports/route.ts` (full replacement)
- Modify: `app/api/student-reports/route.test.ts` (rewrite — the existing tests, if any, test Mongoose behavior that no longer applies)

**Interfaces:**
- Consumes: `listReports` (Task 2).
- Produces: `GET` returns `Array<{ _id, teacherName, className, subject, term, studentCount, createdAt }>` — management sees every report, teachers see only their own. No `POST` on this route (upload only happens through `/api/teacher-portal/reports`, Task 4 — having two divergent creation paths was the root of the original `teacherId` bug).

- [ ] **Step 1: Write the failing tests**

Replace `app/api/student-reports/route.test.ts` entirely (create it if it doesn't exist):

```ts
import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/student-reports') as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('GET /api/student-reports', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('management sees every report across all teachers', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'management' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it('a teacher sees only their own reports', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].className).toBe('Grade 10-A')
  })

  it('never seeds data — an empty database returns an empty array, every time', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'irrelevant', role: 'teacher' } })
    const first = await (await GET(req())).json()
    const second = await (await GET(req())).json()
    expect(first).toEqual([])
    expect(second).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/student-reports/route.test.ts`
Expected: FAIL — the current route still imports the Mongoose model and auto-seeds.

- [ ] **Step 3: Replace the route**

Replace `app/api/student-reports/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listReports } from '@/lib/db/queries/student-reports'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const reports =
      session.user.role === 'management'
        ? await listReports()
        : await listReports({ teacherId: session.user.id })

    const formatted = reports.map((r) => ({
      _id: r.id,
      teacherName: r.teacherName,
      className: r.className,
      subject: r.subject,
      term: r.term,
      studentCount: r.studentCount,
      createdAt: r.createdAt,
    }))

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (err) {
    console.error('[student-reports GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/student-reports/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/student-reports/route.ts app/api/student-reports/route.test.ts
git commit -m "fix: remove fake report seeding, scope student-reports GET by role"
```

---

### Task 6: Fix `/api/student-reports/dashboard` — real filtering, close the auth gap

**Files:**
- Modify: `app/api/student-reports/dashboard/route.ts` (full replacement)
- Modify: `app/api/student-reports/dashboard/route.test.ts` (rewrite)

**Interfaces:**
- Consumes: `listReports`, `getDashboardData` (Task 2, Task 3).
- Produces: `GET` accepts optional `?class=&subject=&term=` query params. Response shape: `{ performanceTrends, uploadedReports, topPerformers, attentionSubjects, filterOptions: { classes, subjects, terms } }`. Each `topPerformers` entry now includes a `reportId` field, which Task 9 (management view) uses to open `ReportDetailModal` (Task 8) when a performer is clicked.
- **Security note found during research:** this route currently has no `auth()` call at all — anyone, logged in or not, can hit it and read every teacher's report data. This task adds the same auth check every other route in this app already has, and scopes results to the caller's own reports when the caller is a teacher (mirroring Task 5's role-scoping) — this is a deliberate fix, not a side effect, since the route was previously wide open.

- [ ] **Step 1: Write the failing tests**

Replace `app/api/student-reports/dashboard/route.test.ts` entirely (create it if it doesn't exist):

```ts
import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url = 'http://localhost/api/student-reports/dashboard') {
  return new Request(url) as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('GET /api/student-reports/dashboard', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('returns empty arrays and no filter options when there is no data', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'irrelevant', role: 'management' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body.uploadedReports).toEqual([])
    expect(body.topPerformers).toEqual([])
    expect(body.filterOptions).toEqual({ classes: [], subjects: [], terms: [] })
  })

  it('filters the uploaded-reports list and analytics by query params', async () => {
    const teacher = await makeTeacher()
    const [reportA] = await db
      .insert(studentReports)
      .values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
      .returning()
    await db.insert(studentReportEntries).values({ reportId: reportA.id, name: 'X', rollNo: '1', marks: 80, maxMarks: 100, grade: 'A' })
    const [reportB] = await db
      .insert(studentReports)
      .values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })
      .returning()
    await db.insert(studentReportEntries).values({ reportId: reportB.id, name: 'Y', rollNo: '2', marks: 40, maxMarks: 100, grade: 'D' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'management' } })
    const res = await GET(req('http://localhost/api/student-reports/dashboard?class=Grade 10-A'))
    const body = await res.json()

    expect(body.uploadedReports).toHaveLength(1)
    expect(body.uploadedReports[0].className).toBe('Grade 10-A')
    expect(body.topPerformers).toHaveLength(1)
    expect(body.topPerformers[0].name).toBe('X')
    expect(body.topPerformers[0].reportId).toBe(reportA.id)
  })

  it('a teacher only sees their own reports, even unfiltered', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await db.insert(studentReports).values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher' } })
    const res = await GET(req())
    const body = await res.json()
    expect(body.uploadedReports).toHaveLength(1)
    expect(body.filterOptions.classes).toEqual(['Grade 10-A'])
  })

  it('returns distinct filter options covering all reports, not just the filtered subset', async () => {
    const teacher = await makeTeacher()
    await db.insert(studentReports).values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
    await db.insert(studentReports).values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Unit Test 1' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'management' } })
    const res = await GET(req('http://localhost/api/student-reports/dashboard?class=Grade 10-A'))
    const body = await res.json()
    expect(body.filterOptions.classes.sort()).toEqual(['Grade 10-A', 'Grade 11-B'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/student-reports/dashboard/route.test.ts`
Expected: FAIL — the current route has no auth check, no query-param filtering, and no `filterOptions` in its response.

- [ ] **Step 3: Replace the route**

Replace `app/api/student-reports/dashboard/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listReports, getDashboardData } from '@/lib/db/queries/student-reports'

export const dynamic = 'force-dynamic'

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const classParam = url.searchParams.get('class') || undefined
    const subjectParam = url.searchParams.get('subject') || undefined
    const termParam = url.searchParams.get('term') || undefined
    const teacherId = session.user.role === 'teacher' ? session.user.id : undefined

    const filters = { teacherId, class: classParam, subject: subjectParam, term: termParam }

    const [reports, dashboard] = await Promise.all([listReports(filters), getDashboardData(filters)])

    const uploadedReports = reports.map((r) => ({
      _id: r.id,
      initials: initialsOf(r.teacherName),
      name: r.teacherName,
      className: r.className,
      subject: r.subject,
      term: r.term,
      date: new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      students: r.studentCount,
      theme: 'blue',
    }))

    const topPerformers = dashboard.topPerformers.map((p, idx) => {
      let bg = ''
      if (idx === 0) bg = 'bg-[#0b1320] text-white'
      else if (idx === 1) bg = 'bg-indigo-100 text-indigo-700'
      else if (idx === 2) bg = 'bg-purple-100 text-purple-700'

      return {
        _id: `top-${idx}`,
        rank: idx + 1,
        name: p.name,
        className: p.className,
        score: `${p.scorePercent.toFixed(1)}%`,
        reportId: p.reportId,
        initials: idx < 3 ? initialsOf(p.name) : (idx + 1).toString(),
        bg,
      }
    })

    const attentionSubjects = dashboard.attentionSubjects.map((s, idx) => ({
      _id: `att-${idx}`,
      subject: s.subject,
      avg: `${s.avgPercent.toFixed(1)}%`,
      target: '65%',
      theme: s.avgPercent < 60 ? 'red' : 'amber',
    }))

    const performanceTrends = dashboard.performanceTrends.map((t, idx) => ({
      _id: `trend-${idx}`,
      label: t.term,
      math: t.math,
      science: t.science,
    }))

    return NextResponse.json(
      {
        performanceTrends,
        uploadedReports,
        topPerformers,
        attentionSubjects,
        filterOptions: {
          classes: dashboard.distinctClasses,
          subjects: dashboard.distinctSubjects,
          terms: dashboard.distinctTerms,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/student-reports/dashboard/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/student-reports/dashboard/route.ts app/api/student-reports/dashboard/route.test.ts
git commit -m "fix: add auth check and real query-param filtering to reports dashboard"
```

---

### Task 7: Fix `/api/student-reports/[id]`, retire the Mongoose model, delete dead components

**Files:**
- Modify: `app/api/student-reports/[id]/route.ts` (full replacement)
- Modify: `app/api/student-reports/[id]/route.test.ts` (rewrite)
- Delete: `models/StudentReport.ts`
- Delete: `components/dashboard/management/StudentReportsAnalytics.tsx`
- Delete: `components/dashboard/management/TeacherPortalDashboard.tsx`
- Delete: `components/dashboard/teacher/StudentPerformanceDashboard.tsx`
- Delete: `components/dashboard/teacher/StudentReportUpload.tsx`

**Interfaces:**
- Consumes: `getReportById` (Task 2).
- Produces: `GET /api/student-reports/[id]` response shape: `{ _id, teacherName, className, subject, term, date, entries: Array<{name, rollNo, marks, maxMarks, grade, attendance, remarks}> }`. Task 8 (`ReportDetailModal`) fetches this directly.
- **Why delete four components, not just the one the spec named:** while implementing Tasks 4-6, grep confirmed `components/dashboard/management/StudentReportsAnalytics.tsx`, `components/dashboard/management/TeacherPortalDashboard.tsx`, `components/dashboard/teacher/StudentPerformanceDashboard.tsx`, and `components/dashboard/teacher/StudentReportUpload.tsx` are ALL dead code — none are imported by any file under `app/`, confirmed by `grep -rln "<ComponentName>" app/` returning nothing for each. All four call the report endpoints this plan is changing, so leaving them in place would mean dead files calling a stale API shape. This step proves each is unreferenced before deleting, so the deletion is verifiable, not just asserted.

- [ ] **Step 1: Write the failing tests**

Replace `app/api/student-reports/[id]/route.test.ts` entirely (create it if it doesn't exist):

```ts
import { db } from '@/lib/db'
import { studentReports, studentReportEntries, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/student-reports/x') as any
}

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('GET /api/student-reports/[id]', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req(), { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 for a non-existent report', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'x', role: 'management' } })
    const res = await GET(req(), { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) })
    expect(res.status).toBe(404)
  })

  it('returns the report with its entries', async () => {
    const teacher = await makeTeacher()
    const [report] = await db
      .insert(studentReports)
      .values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
      .returning()
    await db.insert(studentReportEntries).values({ reportId: report.id, name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B', remarks: 'Good' })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'management' } })
    const res = await GET(req(), { params: Promise.resolve({ id: report.id }) })
    const body = await res.json()

    expect(body._id).toBe(report.id)
    expect(body.entries).toHaveLength(1)
    expect(body.entries[0].name).toBe('Rahul Sharma')
    expect(body.entries[0].remarks).toBe('Good')
  })

  it('forbids a teacher from viewing another teacher report', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    const [report] = await db
      .insert(studentReports)
      .values({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
      .returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherB.id, role: 'teacher' } })
    const res = await GET(req(), { params: Promise.resolve({ id: report.id }) })
    expect(res.status).toBe(403)
  })

  it('allows a teacher to view their own report', async () => {
    const teacher = await makeTeacher()
    const [report] = await db
      .insert(studentReports)
      .values({ teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Finals' })
      .returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher' } })
    const res = await GET(req(), { params: Promise.resolve({ id: report.id }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/student-reports/[id]/route.test.ts`
Expected: FAIL — the current route uses `StudentReport.findById` (Mongoose), not `getReportById`.

- [ ] **Step 3: Replace the route**

Replace `app/api/student-reports/[id]/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getReportById } from '@/lib/db/queries/student-reports'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const report = await getReportById(id)
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (session.user.role === 'teacher' && report.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      _id: report.id,
      teacherName: report.teacherName,
      className: report.className,
      subject: report.subject,
      term: report.term,
      date: new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      entries: report.entries.map((e) => ({
        name: e.name,
        rollNo: e.rollNo,
        marks: e.marks,
        maxMarks: e.maxMarks,
        grade: e.grade,
        attendance: e.attendance,
        remarks: e.remarks,
      })),
    })
  } catch (err) {
    console.error('[student-reports/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/student-reports/[id]/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the four components are genuinely unreferenced, then delete them and the Mongoose model**

Run each of these and confirm every one prints nothing:

```bash
grep -rln "StudentReportsAnalytics" app/
grep -rln "TeacherPortalDashboard" app/
grep -rln "StudentPerformanceDashboard" app/
grep -rln "StudentReportUpload" app/
```

Expected: all four commands produce no output (no matches).

Then delete:

```bash
git rm models/StudentReport.ts
git rm components/dashboard/management/StudentReportsAnalytics.tsx
git rm components/dashboard/management/TeacherPortalDashboard.tsx
git rm components/dashboard/teacher/StudentPerformanceDashboard.tsx
git rm components/dashboard/teacher/StudentReportUpload.tsx
```

- [ ] **Step 6: Run the full test suite and build**

Run: `npm test`
Expected: all suites pass, no test references the deleted files.

Run: `npm run build`
Expected: exits 0 — confirms nothing still imports any of the five deleted files.

- [ ] **Step 7: Commit**

```bash
git add app/api/student-reports/[id]/route.ts app/api/student-reports/[id]/route.test.ts
git commit -m "fix: migrate report-detail route to postgres; delete dead StudentReport model and unused report components"
```

---

### Task 8: Shared `ReportDetailModal` component

**Files:**
- Create: `components/dashboard/ReportDetailModal.tsx`

**Interfaces:**
- Consumes: `GET /api/student-reports/[id]` (Task 7) — response shape `{ _id, teacherName, className, subject, term, date, entries: Array<{name, rollNo, marks, maxMarks, grade, attendance, remarks}> }`.
- Produces: `ReportDetailModal` component, props `{ reportId: string; onClose: () => void }`. Task 9 (management view) and Task 10 (teacher view) both render this directly.
- No automated test for this task (no React component test infra in this project, consistent with every prior frontend task in this codebase) — verified via `npm run build` plus manual browser check.

- [ ] **Step 1: Create the component**

Create `components/dashboard/ReportDetailModal.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'

interface ReportEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number | null
  remarks: string | null
}

interface ReportDetail {
  _id: string
  teacherName: string
  className: string
  subject: string
  term: string
  date: string
  entries: ReportEntry[]
}

interface ReportDetailModalProps {
  reportId: string
  onClose: () => void
}

export default function ReportDetailModal({ reportId, onClose }: ReportDetailModalProps) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/student-reports/${reportId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load report')
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reportId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-100">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {loading ? 'Loading report...' : report ? `${report.className} — ${report.subject}` : 'Report'}
            </h2>
            {report && (
              <p className="text-[12px] text-slate-500 mt-0.5">
                {report.term} · Uploaded by {report.teacherName} · {report.date}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin mb-3" />
              <p className="text-sm font-medium">Loading...</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          ) : report && report.entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No students in this report.</p>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Roll No', 'Marks', 'Grade', 'Attendance', 'Remarks'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report?.entries.map((e, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                      <td className="px-4 py-3 text-slate-600">{e.rollNo || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{e.marks} / {e.maxMarks}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-50 text-indigo-700">{e.grade}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.attendance !== null ? `${e.attendance}%` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{e.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ReportDetailModal.tsx
git commit -m "feat: add shared ReportDetailModal component"
```

---

### Task 9: Make the management Student Reports page fully functional

**Files:**
- Modify: `components/dashboard/management/StudentReportsView.tsx` (full replacement)

**Interfaces:**
- Consumes: `GET /api/student-reports/dashboard?class=&subject=&term=` (Task 6), `ReportDetailModal` (Task 8).
- No automated test for this task (no React component test infra) — verified via `npm run build` plus manual browser check.

- [ ] **Step 1: Replace the component**

Replace `components/dashboard/management/StudentReportsView.tsx` entirely:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Download, Search, AlertTriangle, ChevronRight, Award, CheckCircle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import ReportDetailModal from '@/components/dashboard/ReportDetailModal'

// --- Interfaces ---
interface PerformanceTrend {
  _id: string
  label: string
  math: number
  science: number
}

interface UploadedReport {
  _id: string
  initials: string
  name: string
  className: string
  subject: string
  term: string
  date: string
  students: number
  theme: string
}

interface TopPerformer {
  _id: string
  rank: number
  name: string
  className?: string
  score: string
  initials: string
  bg?: string
  reportId: string
}

interface AttentionSubject {
  _id: string
  subject: string
  avg: string
  target: string
  theme: string
}

interface FilterOptions {
  classes: string[]
  subjects: string[]
  terms: string[]
}

export default function StudentReportsView() {
  const [performanceData, setPerformanceData] = useState<PerformanceTrend[]>([])
  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([])
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [attentionSubjects, setAttentionSubjects] = useState<AttentionSubject[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ classes: [], subjects: [], terms: [] })
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  // Filter dropdown states
  const [selectedClass, setSelectedClass] = useState('All Classes')
  const [selectedTerm, setSelectedTerm] = useState('All Terms')
  const [selectedSubject, setSelectedSubject] = useState('All Subjects')

  // Report detail modal
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedClass !== 'All Classes') params.set('class', selectedClass)
    if (selectedSubject !== 'All Subjects') params.set('subject', selectedSubject)
    if (selectedTerm !== 'All Terms') params.set('term', selectedTerm)

    fetch(`/api/student-reports/dashboard?${params}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setPerformanceData(data.performanceTrends || [])
          setUploadedReports(data.uploadedReports || [])
          setTopPerformers(data.topPerformers || [])
          setAttentionSubjects(data.attentionSubjects || [])
          setFilterOptions(data.filterOptions || { classes: [], subjects: [], terms: [] })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch dashboard data', err)
        setLoading(false)
      })
  }, [selectedClass, selectedSubject, selectedTerm])

  // Filtered reports (client-side search on top of the server-side class/subject/term filtering)
  const filteredReports = uploadedReports.filter(rep => {
    if (!searchQuery) return true
    const lowerQuery = searchQuery.toLowerCase()
    return rep.name.toLowerCase().includes(lowerQuery) || rep.subject.toLowerCase().includes(lowerQuery) || rep.className.toLowerCase().includes(lowerQuery)
  })

  // Pagination
  const itemsPerPage = 3
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage))
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleExport = () => {
    if (filteredReports.length === 0) {
      showToast('No reports to export')
      return
    }
    const headers = ['Teacher', 'Class', 'Subject', 'Term', 'Date', 'Students']
    const rows = filteredReports.map(r => [r.name, r.className, r.subject, r.term, r.date, r.students])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reports')
    XLSX.writeFile(wb, 'uploaded_reports_export.xlsx')
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center bg-slate-50 min-h-screen">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Student Reports & Analytics</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Review uploaded grade reports and performance trends across classes
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClass}
            onChange={(e) => { setSelectedClass(e.target.value); setCurrentPage(1) }}
            className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none cursor-pointer"
          >
            <option>All Classes</option>
            {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={selectedTerm}
            onChange={(e) => { setSelectedTerm(e.target.value); setCurrentPage(1) }}
            className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none cursor-pointer"
          >
            <option>All Terms</option>
            {filterOptions.terms.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={selectedSubject}
            onChange={(e) => { setSelectedSubject(e.target.value); setCurrentPage(1) }}
            className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors outline-none cursor-pointer"
          >
            <option>All Subjects</option>
            {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm active:scale-95">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Chart Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-slate-900">Class Performance Trend</h2>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-600"/> Mathematics</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Science</div>
              </div>
            </div>

            {/* CSS Bar Chart */}
            <div className="relative h-64 flex items-end justify-between px-4 pb-8 pt-4">
              {performanceData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-400">
                  No performance data available. Please upload reports.
                </div>
              ) : (
                <>
                  {/* Y-Axis lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                    {[100, 75, 50, 25, 0].map(val => (
                      <div key={val} className="flex items-center w-full">
                        <span className="text-[10px] text-slate-400 w-6 mr-2 text-right font-medium">{val}</span>
                        <div className="flex-1 border-t border-dashed border-slate-100" />
                      </div>
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="relative z-10 w-full flex justify-around items-end h-full ml-8">
                    {performanceData.map((data, idx) => (
                      <div key={data._id || idx} className="flex flex-col items-center gap-2 group h-full justify-end cursor-pointer" onClick={() => showToast(`${data.label}: Math ${data.math}%, Science ${data.science}%`)}>
                        <div className="flex items-end gap-1.5 h-full">
                          {/* Math Bar */}
                          <div className="w-4 bg-indigo-600 rounded-t-sm hover:opacity-80 transition-opacity relative group-hover:bg-indigo-500" style={{ height: `${data.math}%` }}></div>
                          {/* Science Bar */}
                          <div className="w-4 bg-emerald-500 rounded-t-sm hover:opacity-80 transition-opacity relative group-hover:bg-emerald-400" style={{ height: `${data.science}%` }}></div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 absolute -bottom-6">{data.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Uploaded Reports Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Uploaded Reports</h2>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter reports..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset page on search
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            {paginatedReports.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No reports found matching your criteria.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Teacher</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class / Subject</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Term</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uploaded</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReports.map((rep, idx) => (
                    <tr key={rep._id || idx} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedReportId(rep._id)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            rep.theme === 'indigo' ? 'bg-indigo-100 text-indigo-700' :
                            rep.theme === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {rep.initials}
                          </div>
                          <span className="text-[13px] font-bold text-slate-900">{rep.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] font-bold text-slate-900">{rep.className}</p>
                        <p className="text-[11px] text-slate-500">{rep.subject}</p>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-slate-700">{rep.term}</td>
                      <td className="px-6 py-4">
                        {/* Check if date contains a comma, robust splitting */}
                        <p className="text-[13px] text-slate-700">{rep.date.includes(',') ? rep.date.split(',')[0] : rep.date}</p>
                        {rep.date.includes(',') && <p className="text-[11px] text-slate-500">{rep.date.split(',')[1]}</p>}
                      </td>
                      <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-[12px] text-slate-500">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredReports.length)} to {Math.min(currentPage * itemsPerPage, filteredReports.length)} of {filteredReports.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-200 bg-white text-slate-500 text-[12px] font-semibold rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                      currentPage === page
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">

          {/* Top Performers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-900 mb-6">Top Performers</h2>
            <div className="space-y-4">
              {topPerformers.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No top performer data available yet.
                </div>
              ) : (
                topPerformers.map((perf) => (
                  <div key={perf._id || perf.rank} onClick={() => setSelectedReportId(perf.reportId)} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center gap-3 relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${perf.bg || 'bg-slate-200 text-slate-600'}`}>
                        {perf.bg ? perf.initials : perf.rank}
                      </div>
                      {perf.rank <= 3 && (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black ${
                          perf.rank === 1 ? 'bg-amber-400 text-white' :
                          perf.rank === 2 ? 'bg-slate-300 text-slate-700' :
                          'bg-amber-700 text-white'
                        }`}>
                          {perf.rank}
                        </div>
                      )}
                      <div>
                        <h4 className="text-[13px] font-bold text-slate-900 leading-tight">{perf.name}</h4>
                        {perf.className && <p className="text-[11px] text-slate-500">{perf.className}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[15px] font-black text-slate-900">{perf.score}</span>
                      {perf.rank <= 3 && (
                        <Award className={`w-3.5 h-3.5 ml-auto mt-0.5 ${
                          perf.rank === 1 ? 'text-amber-400' :
                          perf.rank === 2 ? 'text-slate-400' :
                          'text-amber-700'
                        }`} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Needs Attention */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-sm font-bold text-slate-900">Needs Attention</h2>
            </div>
            <p className="text-[13px] text-slate-600 mb-6 leading-relaxed">
              Subjects with average scores below the 65% threshold{selectedClass !== 'All Classes' ? ` across ${selectedClass}` : ''}.
            </p>

            <div className="space-y-3">
              {attentionSubjects.length === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  All subjects are currently performing well!
                </div>
              ) : (
                attentionSubjects.map((sub, idx) => (
                  <div key={sub._id || idx} className={`border p-4 rounded-xl flex items-center justify-between ${
                    sub.theme === 'red' ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/50 border-amber-200'
                  }`}>
                    <div>
                      <h4 className={`text-[14px] font-bold mb-1 ${sub.theme === 'red' ? 'text-red-700' : 'text-amber-700'}`}>{sub.subject}</h4>
                      <p className={`text-[12px] font-semibold ${sub.theme === 'red' ? 'text-red-600/80' : 'text-amber-600/80'}`}>Avg: {sub.avg} (Target: {sub.target})</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${
                      sub.theme === 'red' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {selectedReportId && (
        <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
      )}

    </div>
  )
}
```

- [ ] **Step 2: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Manual verification**

In the browser, on `/management/student-reports`:
1. Confirm the Class/Term/Subject dropdowns are populated with real values (not placeholder text) and changing one actually changes the chart, table, and Top Performers.
2. Click an Uploaded Reports row → `ReportDetailModal` opens showing that report's real per-student breakdown.
3. Click a Top Performer → `ReportDetailModal` opens showing the report that score came from.
4. Click Export → an `.xlsx` downloads with the currently-filtered report list.
5. Confirm Top Performers no longer shows the same name duplicated at the same score.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/management/StudentReportsView.tsx
git commit -m "fix: make management student reports filters, view details, and export functional"
```

---

### Task 10: Make the teacher Student Reports page fully functional

**Files:**
- Modify: `components/dashboard/teacher/TeacherStudentReportsView.tsx` (full replacement)

**Interfaces:**
- Consumes: `POST /api/teacher-portal/reports` (Task 4, now accepts optional `attendance`/`remarks`), `ReportDetailModal` (Task 8).
- No automated test for this task (no React component test infra) — verified via `npm run build` plus manual browser check.

- [ ] **Step 1: Replace the component**

Replace `components/dashboard/teacher/TeacherStudentReportsView.tsx` entirely:

```tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, UploadCloud, FileDown, Search, Filter, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import ReportDetailModal from '@/components/dashboard/ReportDetailModal'

function downloadSampleFormat() {
  const headers = ['Name', 'RollNo', 'Marks', 'MaxMarks', 'Attendance', 'Remarks']
  const data = [
    headers,
    ['Rahul Sharma', '101', '75', '100', '95', 'Good grasp of basics.'],
    ['Priya Patel', '102', '90', '100', '98', 'Excellent performance.'],
    ['Amit Verma', '103', '', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report Template')
  XLSX.writeFile(wb, 'student_report_template.xlsx')
}

export default function TeacherStudentReportsView() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reports, setReports] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<{title: string, desc?: string, type: 'success' | 'info' | 'error'} | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  // Upload State
  const [uploadClass, setUploadClass] = useState('')
  const [uploadSubject, setUploadSubject] = useState('')
  const [uploadTerm, setUploadTerm] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/teacher-portal/reports')
      if (res.ok) {
        const data = await res.json()
        setReports(data)
      }
    } catch (error) {
      console.error('Failed to fetch reports', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (title: string, type: 'success' | 'info' | 'error' = 'info', desc?: string) => {
    setToastMessage({ title, type, desc })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUploadSubmit = async () => {
    if (!uploadClass || !uploadSubject || !uploadTerm || !file) {
      showToast('Missing Fields', 'error', 'Please fill all fields and select a file.')
      return
    }

    setIsUploading(true)

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          // Expecting headers: Name, RollNo, Marks, MaxMarks, Attendance (optional), Remarks (optional)
          const studentsData = jsonData.map((row: any) => {
            const marks = Number(row['Marks'] || row['Score'] || 0)
            const maxMarks = Number(row['MaxMarks'] || row['Total'] || 100)
            let grade = 'C'
            const p = (marks / maxMarks) * 100
            if (p >= 90) grade = 'A+'
            else if (p >= 80) grade = 'A'
            else if (p >= 70) grade = 'B'

            const rawAttendance = row['Attendance']
            const attendance = rawAttendance !== undefined && rawAttendance !== '' ? Number(rawAttendance) : null
            const rawRemarks = row['Remarks']
            const remarks = rawRemarks !== undefined && rawRemarks !== '' ? String(rawRemarks) : null

            return {
              name: row['Name'] || row['Student Name'] || 'Unknown',
              rollNo: row['RollNo'] || row['Roll Number'] || 'N/A',
              marks,
              maxMarks,
              grade,
              attendance,
              remarks
            }
          })

          const payload = {
            className: uploadClass,
            subject: uploadSubject,
            term: uploadTerm,
            students: studentsData
          }

          const res = await fetch('/api/teacher-portal/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          if (res.ok) {
            showToast('Report Uploaded!', 'success', 'Grades have been successfully saved.')
            setIsModalOpen(false)
            setFile(null)
            setUploadClass('')
            setUploadSubject('')
            setUploadTerm('')
            fetchReports() // Refresh table
          } else {
            const data = await res.json().catch(() => ({}))
            showToast('Upload Failed', 'error', data.error || 'Server rejected the report data.')
          }
        } catch (err) {
          console.error(err)
          showToast('Parsing Error', 'error', 'Failed to read the Excel/CSV file.')
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsBinaryString(file)
    } catch (error) {
      console.error(error)
      showToast('Error', 'error', 'An unexpected error occurred.')
      setIsUploading(false)
    }
  }

  return (
    <div className="flex-1 p-8 overflow-auto bg-slate-50 min-h-screen relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 ${
              toastMessage.type === 'success' ? 'bg-emerald-600' :
              toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-[#0b1320]'
            } text-white px-6 py-4 rounded-xl shadow-2xl flex items-start gap-4 z-[100] max-w-sm`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-100" /> : 
             toastMessage.type === 'error' ? <X className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-100" /> :
             <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mt-2 flex-shrink-0" />}
            <div>
              <h4 className="text-sm font-bold">{toastMessage.title}</h4>
              {toastMessage.desc && <p className="text-[13px] text-white/80 mt-1">{toastMessage.desc}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Page Content */}
      <div className={`transition-all duration-300 ${isModalOpen ? 'blur-sm pointer-events-none select-none opacity-50' : ''}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Reports</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Upload and manage grade reports for your classes
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Upload Report
          </button>
        </div>

        {/* Recent Reports Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 min-h-[400px] flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Reports</h2>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search reports..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <FileText className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-base font-bold text-slate-600 mb-1">No Reports Found</p>
              <p className="text-sm font-medium">Upload a grading sheet to get started.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Term</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Students</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Score</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <tr key={rep._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-[13px] font-bold text-slate-900">{rep.class}</td>
                    <td className="px-6 py-4 text-[13px] text-slate-600">{rep.sub}</td>
                    <td className="px-6 py-4 text-[13px] text-slate-600">{rep.term}</td>
                    <td className="px-6 py-4 text-center text-[13px] font-semibold text-slate-700">{rep.students}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-[13px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{rep.avg}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedReportId(rep._id)} className="text-[12px] font-semibold text-indigo-600 hover:underline">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Upload Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white z-10 shrink-0">
                <h2 className="text-base font-bold text-slate-900">Upload New Report</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  disabled={isUploading}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto">
                
                {/* Selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Class</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Grade 11-A"
                      value={uploadClass}
                      onChange={e => setUploadClass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-700 mb-2">Subject</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Physics"
                      value={uploadSubject}
                      onChange={e => setUploadSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Term</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Mid-Term 2024"
                    value={uploadTerm}
                    onChange={e => setUploadTerm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Drag and Drop Area */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-2">Report File</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed ${file ? 'border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50' : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50'} rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group`}
                  >
                    <input 
                      type="file" 
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    
                    {file ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <p className="text-[13px] font-bold text-emerald-800 mb-1">
                          {file.name} selected
                        </p>
                        <p className="text-[11px] text-emerald-600/80 mb-4">
                          Ready to upload and process
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <UploadCloud className="w-6 h-6 text-indigo-600" />
                        </div>
                        <p className="text-[13px] font-bold text-slate-900 mb-1">
                          Click to browse for Excel/CSV file
                        </p>
                        <p className="text-[11px] text-slate-500 mb-4">
                          Requires columns: Name, RollNo, Marks, MaxMarks (Attendance, Remarks optional)
                        </p>
                      </>
                    )}
                    
                    <button onClick={(e) => { e.stopPropagation(); downloadSampleFormat() }} className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 z-10 relative">
                      Download sample format (.xlsx)
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isUploading}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUploadSubmit}
                  disabled={isUploading || !file || !uploadClass || !uploadSubject || !uploadTerm}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#0b1320] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {isUploading ? 'Processing...' : 'Upload Data Sheet'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedReportId && (
        <ReportDetailModal reportId={selectedReportId} onClose={() => setSelectedReportId(null)} />
      )}

    </div>
  )
}
```

- [ ] **Step 2: Verify the build is clean**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Manual verification**

In the browser, on `/teacher/student-reports`:
1. Click Upload Report, fill Class/Subject/Term, select a `.csv`/`.xlsx` with only Name/RollNo/Marks/MaxMarks columns (no Attendance/Remarks) → upload succeeds (this is the bug the user originally reported — confirm it's actually fixed).
2. Upload another file that DOES include Attendance/Remarks columns → upload succeeds and those values are saved.
3. Click "Download sample format" → a real `.xlsx` downloads with headers `Name, RollNo, Marks, MaxMarks, Attendance, Remarks`.
4. Click "View Details" on a row in Recent Reports → `ReportDetailModal` opens with the real per-student breakdown.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/teacher/TeacherStudentReportsView.tsx
git commit -m "fix: make teacher report upload succeed and wire up sample-format download and view details"
```

---
