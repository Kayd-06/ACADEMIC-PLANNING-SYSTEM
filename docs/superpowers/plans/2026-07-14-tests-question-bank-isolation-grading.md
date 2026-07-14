# Tests & Question Bank: Faculty Isolation, Grading, and Paper Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-faculty ownership/isolation to `tests` and `questions`, replace the dead Mongo-backed grading system with a real Postgres-backed grading workflow reachable from the UI, add test-paper PDF attachment with an authorized preview route, and surface live test performance in Student Reports for both admin and faculty.

**Architecture:** `tests`/`questions` gain a nullable `created_by_user_id` column enforced server-side (teachers see only their own rows; management sees everything in their school). A new `test_grades` Postgres table replaces the Mongo `TestResult` model entirely. A new `app/api/tests/[id]/grades` route computes percentages/ranks live rather than storing them. A new `app/api/tests/[id]/paper` route stores/streams a private Vercel Blob PDF with the same ownership check as the grading route. A shared `TestGradingModal` component is used by both the admin "All Tests" tab (new) and the existing faculty Tests tab. `lib/db/queries/tests.ts` adds `computeTestPerformance()`, consumed by both Student Reports surfaces.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (`drizzle-orm/neon-http`), Neon serverless Postgres, Jest (real live Postgres DB, no DB-layer mocking, `maxWorkers: 1`), `@vercel/blob` (OIDC-authenticated, `access: 'private'`).

## Global Constraints

- A teacher only ever sees/edits/deletes/grades `tests`/`questions`/`test_grades` rows where `created_by_user_id` equals their own `session.user.id`. Management sees every row in their school, including legacy rows with `created_by_user_id IS NULL`.
- `schoolId` scoping uses `getSchoolId(session)` from `lib/auth.ts` everywhere — never `session.user.schoolId` directly (that helper already guards against the malformed-UUID values seen in production).
- Test-paper PDFs are attach-only — never parsed into question-bank rows. The existing `/api/tests/questions/upload-pdf` parser is untouched except for stamping `createdByUserId`.
- A test's paper is only ever served through `GET /api/tests/[id]/paper`, which re-checks ownership before streaming — never expose `tests.paperUrl` as a raw client-facing link.
- Grading is only permitted once `test.date <= getLocalToday()` (from `lib/scheduleUtils.ts`, IST-fixed) — a test cannot be graded before its date arrives.
- Percentages and ranks in grading responses are computed at read time from `marksObtained`/`totalMarks` — never stored.
- Student Reports show test performance live, computed from `test_grades` — never duplicated into `student_report_entries`.
- The Mongo `TestResult` model, `app/api/tests/results/route.ts`, and its test file are deleted, not left dormant.
- Run `npm test` and `npx tsc --noEmit` after every task; both must stay clean. Commit after every task.

---

### Task 1: Schema — ownership, program, paper columns, and the `test_grades` table

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/schema.test.ts`
- Create: `lib/db/migrations/0026_test_ownership_grading_papers.sql`
- Modify: `scripts/apply-migration.mjs`

**Interfaces:**
- Produces: `tests.createdByUserId`, `tests.program`, `tests.paperUrl`, `tests.paperFileName`; `questions.createdByUserId`; new `testGrades` Drizzle table + `TestGrade`/`NewTestGrade` types, all importable from `@/lib/db` (re-exported via `lib/db/index.ts`'s `export * from './schema'`). Every later task depends on these.

- [ ] **Step 1: Add the new columns and table to the schema**

In `lib/db/schema.ts`, find the `tests` table block:

```ts
export const tests = pgTable('tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  time: varchar('time', { length: 20 }).notNull().default('10:00 AM'),
  duration: integer('duration').notNull().default(60),
  totalMarks: integer('total_marks').notNull().default(100),
  status: varchar('status', { length: 30 }).notNull().default('Upcoming'), // Upcoming | Pending Grading | Graded
  testType: varchar('test_type', { length: 30 }).notNull().default('Unit Test'), // Unit Test | Mock | DPP
  averageScore: integer('average_score'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Test = typeof tests.$inferSelect
export type NewTest = typeof tests.$inferInsert
```

Replace it with:

```ts
export const tests = pgTable('tests', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  batch: varchar('batch', { length: 255 }).notNull(),
  program: varchar('program', { length: 255 }).notNull().default(''),
  subject: varchar('subject', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  time: varchar('time', { length: 20 }).notNull().default('10:00 AM'),
  duration: integer('duration').notNull().default(60),
  totalMarks: integer('total_marks').notNull().default(100),
  status: varchar('status', { length: 30 }).notNull().default('Upcoming'), // Upcoming | Pending Grading | Graded
  testType: varchar('test_type', { length: 30 }).notNull().default('Unit Test'), // Unit Test | Mock | DPP
  averageScore: integer('average_score'),
  // NULL means this row predates faculty ownership (or was created directly
  // by management) — visible to management only, never to any teacher.
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  paperUrl: text('paper_url'),
  paperFileName: varchar('paper_file_name', { length: 255 }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Test = typeof tests.$inferSelect
export type NewTest = typeof tests.$inferInsert
```

Find the `questions` table block:

```ts
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  subject: varchar('subject', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('Medium'), // Easy | Medium | Hard
  type: varchar('type', { length: 30 }).notNull().default('MCQ'), // MCQ | Numerical | Integer | Subjective
  text: text('text').notNull(),
  // JSON array stored as text: ["Option A", "Option B", ...]
  options: text('options').notNull().default('[]'),
  correctAnswer: text('correct_answer').notNull().default(''),
  marks: integer('marks').notNull().default(4),
  negativeMarks: integer('negative_marks').notNull().default(0),
  source: varchar('source', { length: 100 }).notNull().default('Custom'),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Question = typeof questions.$inferSelect
export type NewQuestion = typeof questions.$inferInsert
```

Replace it with:

```ts
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  subject: varchar('subject', { length: 255 }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('Medium'), // Easy | Medium | Hard
  type: varchar('type', { length: 30 }).notNull().default('MCQ'), // MCQ | Numerical | Integer | Subjective
  text: text('text').notNull(),
  // JSON array stored as text: ["Option A", "Option B", ...]
  options: text('options').notNull().default('[]'),
  correctAnswer: text('correct_answer').notNull().default(''),
  marks: integer('marks').notNull().default(4),
  negativeMarks: integer('negative_marks').notNull().default(0),
  source: varchar('source', { length: 100 }).notNull().default('Custom'),
  // NULL means this row predates faculty ownership — visible to management
  // only, never to any teacher. Same semantics as tests.createdByUserId.
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Question = typeof questions.$inferSelect
export type NewQuestion = typeof questions.$inferInsert
```

Immediately after the `Question`/`NewQuestion` type exports (still before the `// ── Finance & Fee Management ──` comment), add:

```ts

export const testGrades = pgTable('test_grades', {
  id: uuid('id').defaultRandom().primaryKey(),
  testId: uuid('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
  // NULL = not graded yet, or graded but marked absent.
  marksObtained: integer('marks_obtained'),
  correct: integer('correct'),
  incorrect: integer('incorrect'),
  unattempted: integer('unattempted'),
  absent: boolean('absent').notNull().default(false),
  gradedByUserId: uuid('graded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  testStudentUnique: uniqueIndex('test_grades_test_id_student_id_unique').on(table.testId, table.studentId),
}))

export type TestGrade = typeof testGrades.$inferSelect
export type NewTestGrade = typeof testGrades.$inferInsert
```

- [ ] **Step 2: Write the migration file**

Create `lib/db/migrations/0026_test_ownership_grading_papers.sql`:

```sql
ALTER TABLE tests ADD COLUMN IF NOT EXISTS program varchar(255) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS paper_url text;
--> statement-breakpoint
ALTER TABLE tests ADD COLUMN IF NOT EXISTS paper_file_name varchar(255);
--> statement-breakpoint
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS test_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  roll_no varchar(255) NOT NULL DEFAULT '',
  marks_obtained integer,
  correct integer,
  incorrect integer,
  unattempted integer,
  absent boolean NOT NULL DEFAULT false,
  graded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS test_grades_test_id_student_id_unique ON test_grades(test_id, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS test_grades_test_id_idx ON test_grades(test_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS test_grades_student_id_idx ON test_grades(student_id);
```

- [ ] **Step 3: Point the apply script at this migration and run it**

In `scripts/apply-migration.mjs`, change:

```js
const migration = readFileSync('./lib/db/migrations/0025_email_verification_otp.sql', 'utf8') // latest migration
```

to:

```js
const migration = readFileSync('./lib/db/migrations/0026_test_ownership_grading_papers.sql', 'utf8') // latest migration
```

Run: `node scripts/apply-migration.mjs`
Expected: `Applying 9 statements...` followed by each statement logged and `Done.` with exit code 0.

- [ ] **Step 4: Verify against Neon directly**

Run:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const cols = await sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'tests' AND column_name IN ('program','created_by_user_id','paper_url','paper_file_name')\`;
  console.log('tests columns:', cols.map(c => c.column_name));
  const qcols = await sql\`SELECT column_name FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'created_by_user_id'\`;
  console.log('questions columns:', qcols.map(c => c.column_name));
  const tg = await sql\`SELECT COUNT(*) FROM test_grades\`;
  console.log('test_grades row count:', tg[0].count);
})();
"
```

Expected: `tests columns:` lists all 4 new column names, `questions columns:` lists `created_by_user_id`, `test_grades row count: 0`.

- [ ] **Step 5: Update the schema smoke test**

In `lib/db/schema.test.ts`, change:

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

to:

```ts
import { db } from './index'
import { users, emailVerifications, schools, students, studentReports, studentReportEntries, tests, questions, testGrades } from './schema'

describe('schema', () => {
  it('can query all tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(students)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReports)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReportEntries)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(tests)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(questions)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(testGrades)).resolves.toEqual(expect.any(Array))
  })
})
```

- [ ] **Step 6: Run the test**

Run: `npm test -- schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/schema.test.ts lib/db/migrations/0026_test_ownership_grading_papers.sql scripts/apply-migration.mjs
git commit -m "feat: add ownership/program/paper columns and test_grades table"
```

---

### Task 2: `findStudentsByBatch` query helper

**Files:**
- Modify: `lib/db/queries/students.ts`
- Modify: `lib/db/queries/students.test.ts`

**Interfaces:**
- Consumes: `students` table (existing).
- Produces: `findStudentsByBatch(batch: string, schoolId?: string | null): Promise<Student[]>`, imported by Task 5's grading route.

- [ ] **Step 1: Write the failing test**

In `lib/db/queries/students.test.ts`, add to the import list:

```ts
import {
  listStudents,
  findStudentsByClasses,
  countStudentsByClasses,
  deleteStudentsByClasses,
  getStudentById,
  createStudent,
  bulkInsertStudents,
  upsertStudentByRollClassSection,
  updateStudent,
  deactivateStudent,
  deleteStudent,
  deleteAllStudents,
  findStudentsByBatch,
} from './students'
```

Add this test block at the end of the `describe('students queries', ...)` body (before the final closing `})`):

```ts
  it('findStudentsByBatch returns only active students in that batch, sorted by roll number then name', async () => {
    await createStudent({ name: 'Zoe', rollNo: '002', batch: 'Batch A', isActive: true })
    await createStudent({ name: 'Amit', rollNo: '001', batch: 'Batch A', isActive: true })
    await createStudent({ name: 'Different Batch', rollNo: '003', batch: 'Batch B', isActive: true })
    await createStudent({ name: 'Inactive', rollNo: '004', batch: 'Batch A', isActive: false })

    const results = await findStudentsByBatch('Batch A')
    expect(results.map(s => s.name)).toEqual(['Amit', 'Zoe'])
  })

  it('findStudentsByBatch scopes to the given schoolId when provided', async () => {
    await createStudent({ name: 'School A Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000a1' as any })
    await createStudent({ name: 'School B Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000b1' as any })

    const results = await findStudentsByBatch('Batch A', '00000000-0000-0000-0000-0000000000a1')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('School A Student')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/db/queries/students.test.ts`
Expected: FAIL with `findStudentsByBatch is not a function` (or a TypeScript import error).

- [ ] **Step 3: Implement**

In `lib/db/queries/students.ts`, add after `findStudentsByClasses`:

```ts
export async function findStudentsByBatch(batch: string, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [eq(students.batch, batch), eq(students.isActive, true)]
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/db/queries/students.test.ts`
Expected: PASS (all tests including the two new ones).

Note: the `schoolId` foreign-key values used in Step 1's second test (`...a1`/`...b1`) are not real rows in `schools` — this is safe because `students.schoolId` has `onDelete: 'cascade'` but no `NOT NULL`/FK-validation-at-insert issue in this schema (mirrors the same pattern already used by other tests in this file that insert students without a real school row).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/students.ts lib/db/queries/students.test.ts
git commit -m "feat: add findStudentsByBatch query helper"
```

---

### Task 3: Enforce faculty ownership on the tests & question-bank APIs

**Files:**
- Modify: `app/api/tests/schedule/route.ts`
- Modify: `app/api/tests/questions/route.ts`
- Modify: `app/api/tests/questions/upload-pdf/route.ts`
- Create: `app/api/tests/schedule/route.test.ts`
- Create: `app/api/tests/questions/route.test.ts`

**Interfaces:**
- Consumes: `tests`/`questions`/`users` tables (Task 1), `getSchoolId` (`lib/auth.ts`, existing).
- Produces: `GET /api/tests/schedule` and `GET /api/tests/questions` now return `facultyName`/`createdByUserId` per row and accept `program`/`teacherId` query params (schedule) / `teacherId` query param (questions). `POST` on both stamps `createdByUserId`. `PUT`/`DELETE` on both 404 for a teacher targeting a row they don't own. Tasks 7 and 8 (UI) rely on `facultyName` being present in list responses.

- [ ] **Step 1: Rewrite `app/api/tests/schedule/route.ts`**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, tests, users } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

function getScheduleNotificationTime(dateStr: string, timeStr?: string | null): Date {
  const time = timeStr ? timeStr.trim() : '00:00'
  let hours = 0
  let minutes = 0

  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (match) {
    hours = Number(match[1])
    minutes = Number(match[2])
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
  } else {
    const parts = time.split(':').map(Number)
    hours = parts[0] || 0
    minutes = parts[1] || 0
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const eventDate = new Date(year, month - 1, day, hours, minutes)
  return new Date(eventDate.getTime() - 24 * 60 * 60 * 1000)
}

export const dynamic = 'force-dynamic'

// GET — fetch scheduled tests. Teachers see only their own; management sees
// every test in the school (including legacy rows with no owner) plus each
// row's faculty name.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)
    const { searchParams } = new URL(req.url)
    const batch = searchParams.get('batch')
    const status = searchParams.get('status')
    const program = searchParams.get('program')
    const teacherId = searchParams.get('teacherId')

    const conditions: any[] = []
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (batch && batch !== 'All') conditions.push(eq(tests.batch, batch))
    if (status && status !== 'All') conditions.push(eq(tests.status, status))
    if (program && program !== 'All') conditions.push(eq(tests.program, program))
    if (role === 'teacher') {
      conditions.push(eq(tests.createdByUserId, userId))
    } else if (teacherId && teacherId !== 'All') {
      conditions.push(eq(tests.createdByUserId, teacherId))
    }

    const baseQuery = db
      .select({
        id: tests.id,
        title: tests.title,
        batch: tests.batch,
        program: tests.program,
        subject: tests.subject,
        date: tests.date,
        time: tests.time,
        duration: tests.duration,
        totalMarks: tests.totalMarks,
        status: tests.status,
        testType: tests.testType,
        averageScore: tests.averageScore,
        createdByUserId: tests.createdByUserId,
        paperUrl: tests.paperUrl,
        paperFileName: tests.paperFileName,
        schoolId: tests.schoolId,
        createdAt: tests.createdAt,
        facultyName: users.name,
      })
      .from(tests)
      .leftJoin(users, eq(tests.createdByUserId, users.id))

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(asc(tests.date), asc(tests.time))
      : await baseQuery.orderBy(asc(tests.date), asc(tests.time))

    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — schedule a new test, owned by the creating user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, batch, program, subject, date, time, duration, totalMarks, testType } = body

    if (!title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string

    const [created] = await db.insert(tests).values({
      title: title.trim(),
      batch: batch.trim(),
      program: program?.trim() || '',
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      status: 'Upcoming',
      testType: testType || 'Unit Test',
      createdByUserId: userId,
      schoolId,
    }).returning()

    const notifyTime = getScheduleNotificationTime(created.date, created.time)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `New Test Scheduled: ${created.title}`,
        message: `A test for Subject: ${created.subject} (Batch: ${created.batch}) has been scheduled on ${created.date} at ${created.time}.`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit a scheduled test. Teachers may only edit their own.
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, title, batch, program, subject, date, time, duration, totalMarks, testType, status } = body

    if (!id || !title?.trim() || !batch?.trim() || !subject?.trim() || !date || !time?.trim() || !duration || !totalMarks) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(tests.id, id)]
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(tests.createdByUserId, userId))

    const [updated] = await db.update(tests).set({
      title: title.trim(),
      batch: batch.trim(),
      program: program?.trim() || '',
      subject: subject.trim(),
      date,
      time: time.trim(),
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      testType: testType || 'Unit Test',
      status: status || 'Upcoming',
      updatedAt: new Date(),
    }).where(and(...conditions)).returning()

    if (!updated) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const notifyTime = getScheduleNotificationTime(updated.date, updated.time)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `Test Schedule Updated: ${updated.title}`,
        message: `The test details have been updated. Scheduled on ${updated.date} at ${updated.time} (${updated.subject} - ${updated.batch}).`,
        createdAt: notifyTime,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — cancel/delete a scheduled test. Teachers may only delete their own.
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing test ID.' }, { status: 400 })

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(tests.id, id)]
    if (schoolId) conditions.push(eq(tests.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(tests.createdByUserId, userId))

    const [deleted] = await db.delete(tests).where(and(...conditions)).returning()
    if (!deleted) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Result',
        title: `Test Cancelled: ${deleted.title}`,
        message: `The scheduled test for Subject: ${deleted.subject} (Batch: ${deleted.batch}) on ${deleted.date} has been cancelled.`,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write `app/api/tests/schedule/route.test.ts`**

```ts
import { db } from '@/lib/db'
import { tests, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST, PUT, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/schedule ownership', () => {
  afterEach(async () => {
    await db.delete(tests)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('POST stamps createdByUserId with the creating teacher', async () => {
    const teacher = await createUser('Teacher One', 'teacher')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })

    const res = await POST(req('http://localhost/api/tests/schedule', {
      method: 'POST',
      body: JSON.stringify({ title: 'Quiz', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.createdByUserId).toBe(teacher.id)
  })

  it('GET for a teacher only returns their own tests, never another teacher\'s', async () => {
    const teacherA = await createUser('Teacher A', 'teacher')
    const teacherB = await createUser('Teacher B', 'teacher')
    await db.insert(tests).values([
      { title: 'A Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherA.id },
      { title: 'B Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('A Test')
  })

  it('GET for management returns every test in the school, including legacy owner-less rows', async () => {
    const teacher = await createUser('Teacher C', 'teacher')
    const manager = await createUser('Manager A', 'management')
    await db.insert(tests).values([
      { title: 'Owned Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id },
      { title: 'Legacy Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: null },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/schedule'))
    const body = await res.json()
    expect(body.map((t: any) => t.title).sort()).toEqual(['Legacy Test', 'Owned Test'])
  })

  it('PUT returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUser('Teacher D', 'teacher')
    const teacherB = await createUser('Teacher E', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await PUT(req('http://localhost/api/tests/schedule', {
      method: 'PUT',
      body: JSON.stringify({ id: otherTest.id, title: 'Hacked', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', time: '10:00 AM', duration: 60, totalMarks: 100 }),
    }))
    expect(res.status).toBe(404)
  })

  it('DELETE returns 404 when a teacher targets a test they do not own', async () => {
    const teacherA = await createUser('Teacher F', 'teacher')
    const teacherB = await createUser('Teacher G', 'teacher')
    const [otherTest] = await db.insert(tests).values({
      title: 'Not Mine Either', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/schedule?id=${otherTest.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(404)

    const stillThere = await db.select().from(tests).where(eq(tests.id, otherTest.id))
    expect(stillThere).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- app/api/tests/schedule/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 4: Rewrite `app/api/tests/questions/route.ts`**

Replace the entire file with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, questions, users } from '@/lib/db'
import { eq, and, ilike, or, desc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch question bank questions. Teachers see only their own;
// management sees every question in the school plus each row's faculty name.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)
    const { searchParams } = new URL(req.url)
    const subject = searchParams.get('subject')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')
    const teacherId = searchParams.get('teacherId')

    const conditions: any[] = []
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (subject && subject !== 'All') conditions.push(eq(questions.subject, subject))
    if (difficulty && difficulty !== 'All') conditions.push(eq(questions.difficulty, difficulty))
    if (search) {
      conditions.push(
        or(
          ilike(questions.topic, `%${search}%`),
          ilike(questions.text, `%${search}%`)
        )
      )
    }
    if (role === 'teacher') {
      conditions.push(eq(questions.createdByUserId, userId))
    } else if (teacherId && teacherId !== 'All') {
      conditions.push(eq(questions.createdByUserId, teacherId))
    }

    const baseQuery = db
      .select({
        id: questions.id,
        subject: questions.subject,
        topic: questions.topic,
        difficulty: questions.difficulty,
        type: questions.type,
        text: questions.text,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        marks: questions.marks,
        negativeMarks: questions.negativeMarks,
        source: questions.source,
        createdByUserId: questions.createdByUserId,
        schoolId: questions.schoolId,
        createdAt: questions.createdAt,
        facultyName: users.name,
      })
      .from(questions)
      .leftJoin(users, eq(questions.createdByUserId, users.id))

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(questions.createdAt))
      : await baseQuery.orderBy(desc(questions.createdAt))

    const parsed = rows.map(q => ({
      ...q,
      options: (() => { try { return JSON.parse(q.options) } catch { return [] } })()
    }))

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a new question to the bank, owned by the creating user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { subject, topic, difficulty, type, text, options, correctAnswer, marks, negativeMarks, source } = body

    if (!subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string

    const [created] = await db.insert(questions).values({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      options: JSON.stringify(Array.isArray(options) ? options.map((o: string) => o.trim()).filter(Boolean) : []),
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      negativeMarks: negativeMarks ? Number(negativeMarks) : 0,
      source: source?.trim() || 'Custom',
      createdByUserId: userId,
      schoolId,
    }).returning()

    return NextResponse.json({
      ...created,
      options: (() => { try { return JSON.parse(created.options) } catch { return [] } })()
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit an existing question. Teachers may only edit their own.
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, subject, topic, difficulty, type, text, options, correctAnswer, marks, negativeMarks, source } = body

    if (!id || !subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(questions.id, id)]
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(questions.createdByUserId, userId))

    const [updated] = await db.update(questions).set({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      options: JSON.stringify(Array.isArray(options) ? options.map((o: string) => o.trim()).filter(Boolean) : []),
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      negativeMarks: negativeMarks ? Number(negativeMarks) : 0,
      source: source?.trim() || 'Custom',
      updatedAt: new Date(),
    }).where(and(...conditions)).returning()

    if (!updated) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

    return NextResponse.json({
      ...updated,
      options: (() => { try { return JSON.parse(updated.options) } catch { return [] } })()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a question from the bank. Teachers may only delete their own.
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing question ID.' }, { status: 400 })

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(questions.id, id)]
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(questions.createdByUserId, userId))

    const [deleted] = await db.delete(questions).where(and(...conditions)).returning()
    if (!deleted) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Write `app/api/tests/questions/route.test.ts`**

```ts
import { db } from '@/lib/db'
import { questions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

import { auth } from '@/lib/auth'
import { GET, POST, PUT, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/questions ownership', () => {
  afterEach(async () => {
    await db.delete(questions)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('POST stamps createdByUserId with the creating teacher', async () => {
    const teacher = await createUser('Q Teacher One', 'teacher')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })

    const res = await POST(req('http://localhost/api/tests/questions', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Physics', topic: 'Motion', difficulty: 'Easy', type: 'MCQ', text: 'What is velocity?' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.createdByUserId).toBe(teacher.id)
  })

  it('GET for a teacher only returns their own questions', async () => {
    const teacherA = await createUser('Q Teacher A', 'teacher')
    const teacherB = await createUser('Q Teacher B', 'teacher')
    await db.insert(questions).values([
      { subject: 'Physics', topic: 'A', text: 'A Question', createdByUserId: teacherA.id },
      { subject: 'Physics', topic: 'B', text: 'B Question', createdByUserId: teacherB.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/questions'))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].text).toBe('A Question')
  })

  it('GET for management returns every question in the school, including legacy owner-less rows', async () => {
    const teacher = await createUser('Q Teacher C', 'teacher')
    const manager = await createUser('Q Manager A', 'management')
    await db.insert(questions).values([
      { subject: 'Physics', topic: 'Owned', text: 'Owned Question', createdByUserId: teacher.id },
      { subject: 'Physics', topic: 'Legacy', text: 'Legacy Question', createdByUserId: null },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/questions'))
    const body = await res.json()
    expect(body.map((q: any) => q.text).sort()).toEqual(['Legacy Question', 'Owned Question'])
  })

  it('DELETE returns 404 when a teacher targets a question they do not own', async () => {
    const teacherA = await createUser('Q Teacher D', 'teacher')
    const teacherB = await createUser('Q Teacher E', 'teacher')
    const [otherQuestion] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Not Mine', text: 'Not Mine Question', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/questions?id=${otherQuestion.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(404)

    const stillThere = await db.select().from(questions).where(eq(questions.id, otherQuestion.id))
    expect(stillThere).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- app/api/tests/questions/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Stamp ownership in the PDF-to-question-bank parser**

In `app/api/tests/questions/upload-pdf/route.ts`, find:

```ts
    const schoolId = (session.user as any).schoolId as string | null
```

Replace with:

```ts
    const schoolId = (session.user as any).schoolId as string | null
    const userId = (session.user as any).id as string
```

Find the bulk insert:

```ts
    const rows = await db.insert(questions).values(
      parsed.map(q => ({
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        text: q.text,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        source: q.source,
        schoolId,
      }))
    ).returning()
```

Replace with:

```ts
    const rows = await db.insert(questions).values(
      parsed.map(q => ({
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        text: q.text,
        options: JSON.stringify(q.options),
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        source: q.source,
        createdByUserId: userId,
        schoolId,
      }))
    ).returning()
```

- [ ] **Step 8: Run the full test suite and typecheck**

Run: `npm test`
Expected: all suites PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/api/tests/schedule/route.ts app/api/tests/schedule/route.test.ts app/api/tests/questions/route.ts app/api/tests/questions/route.test.ts app/api/tests/questions/upload-pdf/route.ts
git commit -m "feat: enforce per-faculty ownership on tests and question-bank APIs"
```

---

### Task 4: Test-paper PDF attach/preview/delete route

**Files:**
- Create: `app/api/tests/[id]/paper/route.ts`
- Create: `app/api/tests/[id]/paper/route.test.ts`

**Interfaces:**
- Consumes: `tests` table (Task 1), `getSchoolId`/`auth` (existing).
- Produces: `POST /api/tests/[id]/paper` (multipart `file`), `GET /api/tests/[id]/paper` (streams the PDF), `DELETE /api/tests/[id]/paper`. Tasks 7 and 8 (UI) call these three.

- [ ] **Step 1: Write the failing tests**

Create `app/api/tests/[id]/paper/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { tests, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

const mockPut = jest.fn()
const mockGet = jest.fn()
jest.mock('@vercel/blob', () => ({
  put: (...args: any[]) => mockPut(...args),
  get: (...args: any[]) => mockGet(...args),
}))

import { auth } from '@/lib/auth'
import { GET, POST, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/[id]/paper', () => {
  afterEach(async () => {
    await db.delete(tests)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('POST rejects a teacher who does not own the test', async () => {
    const owner = await createUser('Paper Owner', 'teacher')
    const outsider = await createUser('Paper Outsider', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: owner.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: outsider.id, role: 'teacher', schoolId: null } })
    const formData = new FormData()
    formData.append('file', new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' }))
    const res = await POST(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'POST', body: formData }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('POST attaches the paper for the owning teacher', async () => {
    const owner = await createUser('Paper Owner Two', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Two', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: owner.id,
    }).returning()

    mockPut.mockResolvedValue({ url: 'https://example.blob.vercel-storage.com/test-papers/abc.pdf' })
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const formData = new FormData()
    formData.append('file', new File(['%PDF-1.4'], 'my-paper.pdf', { type: 'application/pdf' }))
    const res = await POST(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'POST', body: formData }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.paperFileName).toBe('my-paper.pdf')

    const [updated] = await db.select().from(tests).where(eq(tests.id, test.id))
    expect(updated.paperUrl).toBe('https://example.blob.vercel-storage.com/test-papers/abc.pdf')
  })

  it('GET rejects a management user from a different school', async () => {
    const owner = await createUser('Paper Owner Three', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Three', batch: 'Batch A', subject: 'Physics', date: '2026-08-01',
      createdByUserId: owner.id, paperUrl: 'https://example.blob.vercel-storage.com/x.pdf',
      schoolId: '00000000-0000-0000-0000-0000000000a1' as any,
    }).returning()

    const manager = await createUser('Other School Manager', 'management')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: '00000000-0000-0000-0000-0000000000b1' } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/paper`), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('DELETE clears the paper reference for the owning teacher', async () => {
    const owner = await createUser('Paper Owner Four', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Four', batch: 'Batch A', subject: 'Physics', date: '2026-08-01',
      createdByUserId: owner.id, paperUrl: 'https://example.blob.vercel-storage.com/x.pdf', paperFileName: 'x.pdf',
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'DELETE' }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(200)

    const [updated] = await db.select().from(tests).where(eq(tests.id, test.id))
    expect(updated.paperUrl).toBeNull()
    expect(updated.paperFileName).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/api/tests/\[id\]/paper/route.test.ts"`
Expected: FAIL (module `./route` does not exist).

- [ ] **Step 3: Implement the route**

Create `app/api/tests/[id]/paper/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { put, get } from '@vercel/blob'
import { auth, getSchoolId } from '@/lib/auth'
import { db, tests } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// A test's paper is only ever reached through this route — never expose
// tests.paperUrl directly to the client — so every verb here re-checks the
// same ownership rule: management must match the test's school; a teacher
// must be the test's own creator.
async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return null

  const role = (session.user as any).role
  const userId = (session.user as any).id as string
  const schoolId = getSchoolId(session)

  if (role !== 'teacher' && role !== 'management') return null
  if (schoolId && test.schoolId !== schoolId) return null
  if (role === 'teacher' && test.createdByUserId !== userId) return null

  return test
}

// POST — attach a test-paper PDF (owning teacher or management only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const blob = await put(`test-papers/${test.id}-${safeName}`, file, { access: 'private' })

    const [updated] = await db.update(tests)
      .set({ paperUrl: blob.url, paperFileName: file.name, updatedAt: new Date() })
      .where(eq(tests.id, test.id))
      .returning()

    return NextResponse.json({ paperUrl: updated.paperUrl, paperFileName: updated.paperFileName })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET — stream the attached test-paper PDF (owning teacher or management only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (!test.paperUrl) return NextResponse.json({ error: 'No paper attached to this test.' }, { status: 404 })

    const result = await get(test.paperUrl, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'Failed to access the attached paper.' }, { status: 404 })
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.blob.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${test.paperFileName || 'test-paper.pdf'}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — clear the attached test-paper reference (owning teacher or management only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    await db.update(tests)
      .set({ paperUrl: null, paperFileName: null, updatedAt: new Date() })
      .where(eq(tests.id, test.id))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/api/tests/\[id\]/paper/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/tests/\[id\]/paper/route.ts app/api/tests/\[id\]/paper/route.test.ts
git commit -m "feat: add authorized test-paper PDF attach/preview/delete route"
```

---

### Task 5: Grading API on Postgres — retires the Mongo-backed results route

**Files:**
- Create: `app/api/tests/[id]/grades/route.ts`
- Create: `app/api/tests/[id]/grades/route.test.ts`
- Delete: `app/api/tests/results/route.ts`
- Delete: `app/api/tests/results/route.test.ts`
- Delete: `models/TestResult.ts`

**Interfaces:**
- Consumes: `tests`/`testGrades` tables (Task 1), `findStudentsByBatch` (Task 2), `getLocalToday` (`lib/scheduleUtils.ts`, existing), `notifyRoleInSchool` (existing).
- Produces: `GET /api/tests/[id]/grades` → `{ test, studentResults: [{ studentId, studentName, rollNo, marksObtained, correct, incorrect, unattempted, absent, percentage, rank }] }`. `POST /api/tests/[id]/grades` body `{ grades: [{ studentId, marksObtained?, correct?, incorrect?, unattempted?, absent? }] }` → `{ success, test }`. Tasks 6-8 (grading modal + UI) call these.

- [ ] **Step 1: Write the failing tests**

Create `app/api/tests/[id]/grades/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { tests, testGrades, students, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))
jest.mock('@/lib/scheduleUtils', () => ({ getLocalToday: () => '2026-08-15' }))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/[id]/grades', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('GET returns the real batch roster with null grades when nothing has been saved yet', async () => {
    const owner = await createUser('Grade Owner', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Roster Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    await db.insert(students).values({ name: 'Student One', rollNo: '001', batch: 'Batch Grade', isActive: true })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.studentResults).toHaveLength(1)
    expect(body.studentResults[0].marksObtained).toBeNull()
  })

  it('GET rejects a teacher who does not own the test', async () => {
    const owner = await createUser('Grade Owner Two', 'teacher')
    const outsider = await createUser('Grade Outsider', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Not Yours', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: outsider.id, role: 'teacher', schoolId: null } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
  })

  it('POST rejects grading a test scheduled in the future', async () => {
    const owner = await createUser('Grade Owner Three', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Future Test', batch: 'Batch Grade', subject: 'Physics', date: '2099-01-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [student] = await db.insert(students).values({ name: 'Future Student', rollNo: '001', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST',
      body: JSON.stringify({ grades: [{ studentId: student.id, marksObtained: 80 }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(409)
  })

  it('POST saves grades, computes averageScore, and marks the test Graded', async () => {
    const owner = await createUser('Grade Owner Four', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Gradable Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [s1] = await db.insert(students).values({ name: 'S One', rollNo: '001', batch: 'Batch Grade', isActive: true }).returning()
    const [s2] = await db.insert(students).values({ name: 'S Two', rollNo: '002', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST',
      body: JSON.stringify({ grades: [
        { studentId: s1.id, marksObtained: 80 },
        { studentId: s2.id, marksObtained: 60 },
      ] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.test.status).toBe('Graded')
    expect(body.test.averageScore).toBe(70)

    const getRes = await GET(req(`http://localhost/api/tests/${test.id}/grades`), { params: Promise.resolve({ id: test.id }) })
    const getBody = await getRes.json()
    const byRoll = Object.fromEntries(getBody.studentResults.map((r: any) => [r.rollNo, r]))
    expect(byRoll['001'].rank).toBe(1)
    expect(byRoll['001'].percentage).toBe(80)
    expect(byRoll['002'].rank).toBe(2)
  })

  it('POST is idempotent — grading the same test twice updates rather than duplicates rows', async () => {
    const owner = await createUser('Grade Owner Five', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Regrade Test', batch: 'Batch Grade', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    const [s1] = await db.insert(students).values({ name: 'S Three', rollNo: '003', batch: 'Batch Grade', isActive: true }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST', body: JSON.stringify({ grades: [{ studentId: s1.id, marksObtained: 50 }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    await POST(req(`http://localhost/api/tests/${test.id}/grades`, {
      method: 'POST', body: JSON.stringify({ grades: [{ studentId: s1.id, marksObtained: 90 }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const rows = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].marksObtained).toBe(90)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/api/tests/\[id\]/grades/route.test.ts"`
Expected: FAIL (module `./route` does not exist).

- [ ] **Step 3: Implement the route**

Create `app/api/tests/[id]/grades/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, tests, testGrades } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { findStudentsByBatch } from '@/lib/db/queries/students'
import { getLocalToday } from '@/lib/scheduleUtils'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return { test: null, forbidden: false }

  const role = (session.user as any).role
  const userId = (session.user as any).id as string
  const schoolId = getSchoolId(session)

  if (schoolId && test.schoolId !== schoolId) return { test: null, forbidden: false }
  if (role !== 'teacher' && role !== 'management') return { test, forbidden: true }
  if (role === 'teacher' && test.createdByUserId !== userId) return { test, forbidden: true }

  return { test, forbidden: false }
}

// Dense ranking over present, graded students only — an absent or ungraded
// student gets no rank at all rather than being sorted to the bottom.
function calculateRanks(rows: { studentId: string; marksObtained: number | null; absent: boolean }[]): Map<string, number> {
  const graded = rows
    .filter(r => !r.absent && r.marksObtained !== null)
    .sort((a, b) => (b.marksObtained as number) - (a.marksObtained as number))

  const rankByStudent = new Map<string, number>()
  let currentRank = 1
  graded.forEach((r, index) => {
    if (index > 0 && r.marksObtained !== graded[index - 1].marksObtained) currentRank = index + 1
    rankByStudent.set(r.studentId, currentRank)
  })
  return rankByStudent
}

// GET — real batch roster left-joined with any saved grades for this test.
// percentage/rank are always computed here, never stored.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const roster = await findStudentsByBatch(test.batch, test.schoolId)
    const grades = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    const gradeByStudent = new Map(grades.map(g => [g.studentId, g]))

    const ranks = calculateRanks(
      roster.map(s => {
        const g = gradeByStudent.get(s.id)
        return { studentId: s.id, marksObtained: g?.marksObtained ?? null, absent: g?.absent ?? false }
      })
    )

    const studentResults = roster.map(s => {
      const g = gradeByStudent.get(s.id)
      const marksObtained = g?.marksObtained ?? null
      const absent = g?.absent ?? false
      const percentage = !absent && marksObtained !== null
        ? Math.round((marksObtained / test.totalMarks) * 1000) / 10
        : null
      return {
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo || '',
        marksObtained,
        correct: g?.correct ?? null,
        incorrect: g?.incorrect ?? null,
        unattempted: g?.unattempted ?? null,
        absent,
        percentage,
        rank: ranks.get(s.id) ?? null,
      }
    })

    return NextResponse.json({ test, studentResults })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — upsert grades for the real batch roster. Only permitted once the
// test's own date has arrived.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (test.date > getLocalToday()) {
      return NextResponse.json({ error: 'This test cannot be graded before its scheduled date.' }, { status: 409 })
    }

    const body = await req.json()
    const grades = body.grades
    if (!Array.isArray(grades)) {
      return NextResponse.json({ error: 'Missing grades array.' }, { status: 400 })
    }

    const userId = (session.user as any).id as string
    const roster = await findStudentsByBatch(test.batch, test.schoolId)
    const rosterById = new Map(roster.map(s => [s.id, s]))

    for (const entry of grades) {
      const student = entry.studentId ? rosterById.get(entry.studentId) : undefined
      if (!student) continue

      const absent = !!entry.absent
      const toIntOrNull = (v: any) => (absent || v === undefined || v === null || v === '') ? null : Number(v)

      const values = {
        testId: test.id,
        studentId: student.id,
        rollNo: student.rollNo || '',
        marksObtained: toIntOrNull(entry.marksObtained),
        correct: toIntOrNull(entry.correct),
        incorrect: toIntOrNull(entry.incorrect),
        unattempted: toIntOrNull(entry.unattempted),
        absent,
        gradedByUserId: userId,
        schoolId: test.schoolId,
        updatedAt: new Date(),
      }

      const [existing] = await db.select().from(testGrades)
        .where(and(eq(testGrades.testId, test.id), eq(testGrades.studentId, student.id)))

      if (existing) {
        await db.update(testGrades).set(values).where(eq(testGrades.id, existing.id))
      } else {
        await db.insert(testGrades).values(values)
      }
    }

    const savedGrades = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    const presentPercentages = savedGrades
      .filter(g => !g.absent && g.marksObtained !== null)
      .map(g => ((g.marksObtained as number) / test.totalMarks) * 100)
    const averageScore = presentPercentages.length > 0
      ? Math.round(presentPercentages.reduce((sum, p) => sum + p, 0) / presentPercentages.length)
      : null

    const [updatedTest] = await db.update(tests)
      .set({ averageScore, status: 'Graded', updatedAt: new Date() })
      .where(eq(tests.id, test.id))
      .returning()

    await notifyRoleInSchool(
      ['teacher', 'management'],
      test.schoolId,
      {
        category: 'Result',
        title: `Test Results Declared: ${test.title}`,
        message: `Results for Subject: ${test.subject} (Batch: ${test.batch}) have been declared.${averageScore !== null ? ` Class Average: ${averageScore}%.` : ''}`,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json({ success: true, test: updatedTest })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/api/tests/\[id\]/grades/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Delete the Mongo-backed results route and model**

```bash
git rm app/api/tests/results/route.ts app/api/tests/results/route.test.ts models/TestResult.ts
```

Run: `npx tsc --noEmit`
Expected: no errors (confirms nothing else still imports `models/TestResult` or `app/api/tests/results`).

Run: `npm test`
Expected: all remaining suites PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/tests/\[id\]/grades/route.ts app/api/tests/\[id\]/grades/route.test.ts
git commit -m "feat: replace Mongo-backed test grading with a Postgres grades route"
```

---

### Task 6: Shared `TestGradingModal` component

**Files:**
- Create: `components/dashboard/TestGradingModal.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/tests/[id]/grades` (Task 5).
- Produces: `<TestGradingModal test={{ id, title, batch, totalMarks, date }} onClose={() => void} onSaved={() => void} />`, used by Tasks 7 (admin) and 8 (faculty).

- [ ] **Step 1: Implement the component**

Create `components/dashboard/TestGradingModal.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, AlertCircle } from 'lucide-react'
import { useAlert } from '@/components/dashboard/AlertProvider'

interface GradeRow {
  studentId: string
  studentName: string
  rollNo: string
  marksObtained: number | null
  correct: number | null
  incorrect: number | null
  unattempted: number | null
  absent: boolean
  percentage: number | null
  rank: number | null
}

interface TestGradingModalProps {
  test: { id: string; title: string; batch: string; totalMarks: number; date: string }
  onClose: () => void
  onSaved: () => void
}

export default function TestGradingModal({ test, onClose, onSaved }: TestGradingModalProps) {
  const { showAlert } = useAlert()
  const [rows, setRows] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/tests/${test.id}/grades`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load roster')
        return data
      })
      .then((data) => { if (!cancelled) setRows(data.studentResults) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [test.id])

  function updateRow(studentId: string, patch: Partial<GradeRow>) {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, ...patch } : r))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tests/${test.id}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grades: rows.map(r => ({
            studentId: r.studentId,
            marksObtained: r.marksObtained,
            correct: r.correct,
            incorrect: r.incorrect,
            unattempted: r.unattempted,
            absent: r.absent,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save grades')
      onSaved()
      onClose()
    } catch (err: any) {
      showAlert({ title: 'Failed to Save Grades', message: err.message, type: 'warning', onRetry: handleSave, retryText: 'Retry' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-slate-100"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Grade: {test.title}</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{test.batch} · Total Marks {test.totalMarks} · {test.date}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin mb-3" />
                <p className="text-sm font-medium">Loading roster...</p>
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No students found in this batch.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Student', 'Roll No', 'Marks', 'Correct', 'Incorrect', 'Unattempted', 'Absent'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((r) => (
                      <tr key={r.studentId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{r.studentName}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.rollNo || '—'}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0" max={test.totalMarks}
                            disabled={r.absent}
                            value={r.marksObtained ?? ''}
                            onChange={(e) => updateRow(r.studentId, { marksObtained: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.correct ?? ''}
                            onChange={(e) => updateRow(r.studentId, { correct: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.incorrect ?? ''}
                            onChange={(e) => updateRow(r.studentId, { incorrect: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0"
                            disabled={r.absent}
                            value={r.unattempted ?? ''}
                            onChange={(e) => updateRow(r.studentId, { unattempted: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={r.absent}
                            onChange={(e) => updateRow(r.studentId, { absent: e.target.checked })}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && !error && rows.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-6 bg-[#0b1320] text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save Grades
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/TestGradingModal.tsx
git commit -m "feat: add shared TestGradingModal component"
```

---

### Task 7: Admin UI — new "All Tests" tab in `TestsBankView.tsx`

**Files:**
- Modify: `components/dashboard/management/TestsBankView.tsx`

**Interfaces:**
- Consumes: `GET /api/tests/schedule` (now returns `facultyName`/`program`/`paperUrl`, Task 3), `GET /api/programs` (existing), `POST/GET/DELETE /api/tests/[id]/paper` (Task 4), `TestGradingModal` (Task 6).

The existing Calendar and Question Bank Overview tabs are untouched. This task adds a third tab giving management a full list of every test in the school (mirroring the table the faculty side already has), with Faculty and Program columns/filters, a Paper action, and a Grade action.

- [ ] **Step 1: Extend tab state and add programs/paper-upload/grading state**

Find:

```tsx
export default function TestsBankView() {
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState<'calendar' | 'questions'>('calendar')
```

Replace with:

```tsx
export default function TestsBankView() {
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState<'calendar' | 'tests' | 'questions'>('calendar')
```

Find:

```tsx
  const [availableBatches, setAvailableBatches] = useState<string[]>([])

  // Pagination for questions
  const [questionPage, setQuestionPage] = useState(1)
  const itemsPerPage = 5
```

Replace with:

```tsx
  const [availableBatches, setAvailableBatches] = useState<string[]>([])
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([])

  // "All Tests" tab filters
  const [testFacultyFilter, setTestFacultyFilter] = useState('All')
  const [testProgramFilter, setTestProgramFilter] = useState('All')
  const [uploadingPaperFor, setUploadingPaperFor] = useState<string | null>(null)
  const [gradingTest, setGradingTest] = useState<any | null>(null)

  // Pagination for questions
  const [questionPage, setQuestionPage] = useState(1)
  const itemsPerPage = 5
```

- [ ] **Step 2: Fetch available programs alongside batches**

Find:

```tsx
      const bRes = await fetch('/api/daily-report', { method: 'PUT' })
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setAvailableBatches(bData)
        if (bData.length > 0) {
          setTestForm(prev => ({ ...prev, batch: bData[0] }))
        } else {
          setTestForm(prev => ({ ...prev, batch: '' }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
```

Replace with:

```tsx
      const bRes = await fetch('/api/daily-report', { method: 'PUT' })
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setAvailableBatches(bData)
        if (bData.length > 0) {
          setTestForm(prev => ({ ...prev, batch: bData[0] }))
        } else {
          setTestForm(prev => ({ ...prev, batch: '' }))
        }
      }

      const pRes = await fetch('/api/programs')
      const pData = await pRes.json()
      if (Array.isArray(pData)) {
        setAvailablePrograms(pData.map((p: any) => p.name).filter(Boolean))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Add a paper-upload handler and derive the faculty filter list**

Add this block right after the `fetchStatsAndData`/`submitTest`/etc. function definitions, immediately before the `// Create Question Submit` comment:

```tsx
  async function handlePaperUpload(testId: string, file: File) {
    setUploadingPaperFor(testId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tests/${testId}/paper`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.error) {
        fetchStatsAndData()
      } else {
        showAlert({ title: 'Failed to Attach Paper', message: data.error, type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Error', message: 'Network error while attaching the paper.', type: 'warning' })
    } finally {
      setUploadingPaperFor(null)
    }
  }

  const availableFaculty = Array.from(
    new Set(scheduledTests.map((t: any) => t.facultyName).filter(Boolean))
  ) as string[]

  const filteredScheduledTests = scheduledTests.filter((t: any) => {
    const matchesFaculty = testFacultyFilter === 'All' || t.facultyName === testFacultyFilter
    const matchesProgram = testProgramFilter === 'All' || t.program === testProgramFilter
    return matchesFaculty && matchesProgram
  })
```

- [ ] **Step 4: Add the "All Tests" tab button**

Find:

```tsx
          <button 
            onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'questions' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Question Bank Overview
            {activeTab === 'questions' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
        </div>
```

Replace with:

```tsx
          <button 
            onClick={() => { setActiveTab('tests'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'tests' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            All Tests
            {activeTab === 'tests' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
          <button 
            onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'questions' ? 'text-[#0b1320]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Question Bank Overview
            {activeTab === 'questions' && (
              <motion.div layoutId="test-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0b1320]" />
            )}
          </button>
        </div>
```

- [ ] **Step 5: Add the "All Tests" tab content**

Find the line that switches between calendar and question-bank content:

```tsx
        ) : activeTab === 'calendar' ? (
```

This introduces the calendar block, which ends (per the file's existing structure) right before:

```tsx
        ) : (

          // TAB 2: Question Bank Overview
```

Change that closing/opening pair from:

```tsx
        ) : (

          // TAB 2: Question Bank Overview
```

to:

```tsx
        ) : activeTab === 'tests' ? (

          // TAB 2: All Tests (every test in the school, with faculty/program)
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Every Scheduled Test</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={testFacultyFilter}
                    onChange={(e) => setTestFacultyFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Faculty</option>
                    {availableFaculty.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={testProgramFilter}
                    onChange={(e) => setTestProgramFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Programs</option>
                    {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Program</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredScheduledTests.length > 0 ? (
                      filteredScheduledTests.map((t: any) => {
                        const isGradable = t.date <= new Date().toISOString().split('T')[0]
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-semibold text-slate-800">{t.title}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t.subject}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.facultyName || '—'}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.batch}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.program || '—'}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-600">{t.date}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                t.status === 'Graded' ? 'bg-green-50 text-green-700 border border-green-100' :
                                t.status === 'Pending Grading' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-blue-50 text-blue-700 border border-blue-100'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {t.paperUrl ? (
                                  <a
                                    href={`/api/tests/${t.id}/paper`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    View Paper
                                  </a>
                                ) : (
                                  <label className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                                    {uploadingPaperFor === t.id ? 'Uploading...' : 'Add Paper'}
                                    <input
                                      type="file" accept="application/pdf" className="hidden"
                                      disabled={uploadingPaperFor === t.id}
                                      onChange={(e) => { if (e.target.files?.[0]) handlePaperUpload(t.id, e.target.files[0]) }}
                                    />
                                  </label>
                                )}
                                <button
                                  onClick={() => setGradingTest(t)}
                                  disabled={!isGradable}
                                  className="px-2.5 py-1 text-[10px] font-bold text-white bg-[#0b1320] hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                                  title={isGradable ? 'Grade this test' : 'Upcoming — not gradable yet'}
                                >
                                  Grade
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          No tests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        ) : (

          // TAB 2: Question Bank Overview
```

- [ ] **Step 6: Add a Faculty column/filter to the existing Question Bank Overview tab**

The spec requires the Question Bank Overview table (unchanged tab, still shows every question in the school since management bypasses the ownership filter) to also carry a Faculty column and filter — Task 3's `GET /api/tests/questions` already returns `facultyName` per row for management; this step just displays it.

Find:

```tsx
  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = subjectFilter === 'All' || q.subject === subjectFilter
    const matchesDifficulty = difficultyFilter === 'All' || q.difficulty === difficultyFilter
    
    return matchesSearch && matchesSubject && matchesDifficulty
  })
```

Replace with:

```tsx
  // Filter questions
  const availableQuestionFaculty = Array.from(
    new Set(questions.map((q: any) => q.facultyName).filter(Boolean))
  ) as string[]

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = subjectFilter === 'All' || q.subject === subjectFilter
    const matchesDifficulty = difficultyFilter === 'All' || q.difficulty === difficultyFilter
    const matchesFaculty = questionFacultyFilter === 'All' || (q as any).facultyName === questionFacultyFilter
    
    return matchesSearch && matchesSubject && matchesDifficulty && matchesFaculty
  })
```

Add `questionFacultyFilter` state next to the existing `difficultyFilter` state. Find:

```tsx
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
```

Replace with:

```tsx
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [questionFacultyFilter, setQuestionFacultyFilter] = useState('All')
```

Add the filter dropdown next to the Difficulty filter. Find:

```tsx
                {/* Difficulty Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowExportModal(true)}
```

Replace with:

```tsx
                {/* Difficulty Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={difficultyFilter}
                    onChange={(e) => { setDifficultyFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* Faculty Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select 
                    value={questionFacultyFilter}
                    onChange={(e) => { setQuestionFacultyFilter(e.target.value); setQuestionPage(1); }}
                    className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
                  >
                    <option value="All">All Faculty</option>
                    {availableQuestionFaculty.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowExportModal(true)}
```

Add the Faculty column to the table. Find:

```tsx
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Topic</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Difficulty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correct Answer</th>
                    </tr>
                  </thead>
```

Replace with:

```tsx
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Topic</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Subject</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Question Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Difficulty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faculty</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correct Answer</th>
                    </tr>
                  </thead>
```

Find:

```tsx
                          <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{q.type}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 truncate max-w-[150px]">{q.correctAnswer || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-sm font-semibold text-slate-400">
                          No questions found. Add a question to populate your bank.
                        </td>
                      </tr>
                    )}
```

Replace with:

```tsx
                          <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">{q.type}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600">{(q as any).facultyName || '—'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 truncate max-w-[150px]">{q.correctAnswer || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-sm font-semibold text-slate-400">
                          No questions found. Add a question to populate your bank.
                        </td>
                      </tr>
                    )}
```

- [ ] **Step 7: Render the grading modal**

Find the end of the component, immediately before its closing `)` and `}` (the last lines of the file, after the export/upload/question modals). Locate:

```tsx
      <UploadPdfModal 
```

(this appears once, near the end of `TestsBankView.tsx`). Immediately before that line, add:

```tsx
      {gradingTest && (
        <TestGradingModal
          test={gradingTest}
          onClose={() => setGradingTest(null)}
          onSaved={fetchStatsAndData}
        />
      )}

      <UploadPdfModal 
```

- [ ] **Step 7: Import `TestGradingModal`**

Find:

```tsx
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
import ExportQuestionsModal from '@/components/dashboard/ExportQuestionsModal'
```

Replace with:

```tsx
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
import ExportQuestionsModal from '@/components/dashboard/ExportQuestionsModal'
import TestGradingModal from '@/components/dashboard/TestGradingModal'
```

- [ ] **Step 8: Typecheck and manual verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Start the dev server (`npm run dev`), log in as a management user, open Tests & Question Bank → All Tests tab. Verify: the table lists every test with a Faculty and Program column, the Faculty/Program filters narrow the list, "Add Paper" uploads a PDF and switches to "View Paper" which opens it in a new tab, and "Grade" (enabled only for tests dated today or earlier) opens the grading modal, saves, and updates the row's Status to Graded.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/management/TestsBankView.tsx
git commit -m "feat: add All Tests tab with faculty/program visibility and grading to admin"
```

---

### Task 8: Faculty UI — extend `TeacherTestsView.tsx`'s existing Tests tab

**Files:**
- Modify: `components/dashboard/teacher/TeacherTestsView.tsx`

**Interfaces:**
- Consumes: `GET /api/tests/schedule` (now teacher-scoped and returns `program`/`paperUrl`, Task 3), `GET /api/programs` (existing), `POST/GET /api/tests/[id]/paper` (Task 4), `TestGradingModal` (Task 6).

- [ ] **Step 1: Add programs/paper-upload/grading state**

Find:

```tsx
  const [availableBatches, setAvailableBatches] = useState<string[]>([])
```

Replace with:

```tsx
  const [availableBatches, setAvailableBatches] = useState<string[]>([])
  const [availablePrograms, setAvailablePrograms] = useState<string[]>([])
  const [uploadingPaperFor, setUploadingPaperFor] = useState<string | null>(null)
  const [gradingTest, setGradingTest] = useState<any | null>(null)
```

- [ ] **Step 2: Fetch programs alongside batches, and add `program` to the test form**

Find:

```tsx
  // Test Form State
  const [testForm, setTestForm] = useState({
    title: '',
    batch: '',
    subject: 'Physics (PHY-101)',
    date: '',
    time: '10:00 AM',
    duration: '180',
    totalMarks: '300',
    testType: 'Unit Test' as 'Unit Test' | 'Mock' | 'DPP'
  })
```

Replace with:

```tsx
  // Test Form State
  const [testForm, setTestForm] = useState({
    title: '',
    batch: '',
    program: '',
    subject: 'Physics (PHY-101)',
    date: '',
    time: '10:00 AM',
    duration: '180',
    totalMarks: '300',
    testType: 'Unit Test' as 'Unit Test' | 'Mock' | 'DPP'
  })
```

Find:

```tsx
      const bRes = await fetch('/api/daily-report', { method: 'PUT' })
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setAvailableBatches(bData)
        if (bData.length > 0) {
          setTestForm(prev => ({ ...prev, batch: bData[0] }))
        } else {
          setTestForm(prev => ({ ...prev, batch: '' }))
        }
      }
    } catch (err) {
      console.error('Error loading tests/questions/batches:', err)
    } finally {
      setLoading(false)
    }
  }
```

Replace with:

```tsx
      const bRes = await fetch('/api/daily-report', { method: 'PUT' })
      const bData = await bRes.json()
      if (Array.isArray(bData)) {
        setAvailableBatches(bData)
        if (bData.length > 0) {
          setTestForm(prev => ({ ...prev, batch: bData[0] }))
        } else {
          setTestForm(prev => ({ ...prev, batch: '' }))
        }
      }

      const pRes = await fetch('/api/programs')
      const pData = await pRes.json()
      if (Array.isArray(pData)) {
        setAvailablePrograms(pData.map((p: any) => p.name).filter(Boolean))
      }
    } catch (err) {
      console.error('Error loading tests/questions/batches:', err)
    } finally {
      setLoading(false)
    }
  }
```

Find both occurrences of the test-form reset object (in `submitTestData`'s success branch and in the "Create Test" button's `onClick`):

```tsx
        setTestForm({
          title: '',
          batch: availableBatches[0] || '',
          subject: 'Physics (PHY-101)',
          date: '',
          time: '10:00 AM',
          duration: '180',
          totalMarks: '300',
          testType: 'Unit Test'
        })
```

Replace **both** occurrences with:

```tsx
        setTestForm({
          title: '',
          batch: availableBatches[0] || '',
          program: availablePrograms[0] || '',
          subject: 'Physics (PHY-101)',
          date: '',
          time: '10:00 AM',
          duration: '180',
          totalMarks: '300',
          testType: 'Unit Test'
        })
```

Find `handleTestEditClick`:

```tsx
  function handleTestEditClick(t: any) {
    setEditingTest(t)
    setTestForm({
      title: t.title,
      batch: t.batch,
      subject: t.subject,
      date: t.date,
      time: t.time,
      duration: String(t.duration),
      totalMarks: String(t.totalMarks),
      testType: t.testType || 'Unit Test'
    })
    setShowTestModal(true)
  }
```

Replace with:

```tsx
  function handleTestEditClick(t: any) {
    setEditingTest(t)
    setTestForm({
      title: t.title,
      batch: t.batch,
      program: t.program || '',
      subject: t.subject,
      date: t.date,
      time: t.time,
      duration: String(t.duration),
      totalMarks: String(t.totalMarks),
      testType: t.testType || 'Unit Test'
    })
    setShowTestModal(true)
  }
```

- [ ] **Step 3: Add a Program dropdown to the Create/Edit Test modal**

Find:

```tsx
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Subject *</label>
                  <input 
                    type="text" required
                    value={testForm.subject}
                    onChange={(e) => setTestForm({...testForm, subject: e.target.value})}
                    placeholder="e.g. Physics (PHY-101)"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>
```

Replace with:

```tsx
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Subject *</label>
                  <input 
                    type="text" required
                    value={testForm.subject}
                    onChange={(e) => setTestForm({...testForm, subject: e.target.value})}
                    placeholder="e.g. Physics (PHY-101)"
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Program</label>
                  <select
                    value={testForm.program}
                    onChange={(e) => setTestForm({...testForm, program: e.target.value})}
                    className="w-full mt-1.5 px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-slate-400 transition-colors cursor-pointer"
                  >
                    <option value="">No specific program</option>
                    {availablePrograms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
```

- [ ] **Step 4: Add a paper-upload handler**

Add this function right after `handleTestEditClick`:

```tsx
  async function handlePaperUpload(testId: string, file: File) {
    setUploadingPaperFor(testId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tests/${testId}/paper`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.error) {
        loadData()
      } else {
        showAlert({ title: 'Failed to Attach Paper', message: data.error, type: 'warning' })
      }
    } catch (err) {
      console.error(err)
      showAlert({ title: 'Error', message: 'Network error while attaching the paper.', type: 'warning' })
    } finally {
      setUploadingPaperFor(null)
    }
  }
```

- [ ] **Step 5: Add Paper and Grade actions to the Tests table**

Find the Tests table header:

```tsx
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Batch</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Type</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date & Time</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Duration</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Total Marks</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
```

This header is unchanged — Paper/Grade become part of the existing Actions cell. Find the Actions cell body:

```tsx
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <button 
                                  onClick={() => handleTestEditClick(t)}
                                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleTestDelete(t.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
```

Replace with:

```tsx
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {t.paperUrl ? (
                                  <a
                                    href={`/api/tests/${t.id}/paper`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    Paper
                                  </a>
                                ) : (
                                  <label className="px-2 py-1 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                                    {uploadingPaperFor === t.id ? '...' : 'Add Paper'}
                                    <input
                                      type="file" accept="application/pdf" className="hidden"
                                      disabled={uploadingPaperFor === t.id}
                                      onChange={(e) => { if (e.target.files?.[0]) handlePaperUpload(t.id, e.target.files[0]) }}
                                    />
                                  </label>
                                )}
                                <button
                                  onClick={() => setGradingTest(t)}
                                  disabled={t.date > new Date().toISOString().split('T')[0]}
                                  className="px-2 py-1 text-[9px] font-bold text-white bg-[#0b1320] hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
                                  title={t.date > new Date().toISOString().split('T')[0] ? 'Upcoming — not gradable yet' : 'Grade this test'}
                                >
                                  Grade
                                </button>
                                <button 
                                  onClick={() => handleTestEditClick(t)}
                                  className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleTestDelete(t.id)}
                                  className="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
```

- [ ] **Step 6: Render the grading modal and import it**

Find:

```tsx
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
```

Replace with:

```tsx
import UploadPdfModal from '@/components/dashboard/UploadPdfModal'
import TestGradingModal from '@/components/dashboard/TestGradingModal'
```

Find:

```tsx
      <UploadPdfModal 
        isOpen={showUploadPdfModal} 
        onClose={() => setShowUploadPdfModal(false)} 
        onSuccess={loadData} 
      />

    </div>
  )
}
```

Replace with:

```tsx
      <UploadPdfModal 
        isOpen={showUploadPdfModal} 
        onClose={() => setShowUploadPdfModal(false)} 
        onSuccess={loadData} 
      />

      {gradingTest && (
        <TestGradingModal
          test={gradingTest}
          onClose={() => setGradingTest(null)}
          onSaved={loadData}
        />
      )}

    </div>
  )
}
```

- [ ] **Step 7: Typecheck and manual verification**

Run: `npx tsc --noEmit`
Expected: no errors.

On the dev server, log in as a teacher, open Tests & Question Bank → Tests. Verify: only that teacher's own tests appear (create a second teacher account and confirm their tests never show up here), the Create Test form has a Program dropdown, "Add Paper" attaches a PDF and switches to a "Paper" link that opens it, and "Grade" (disabled for future-dated tests) opens the grading modal and saves.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/teacher/TeacherTestsView.tsx
git commit -m "feat: add program field, paper attachment, and grading to faculty Tests tab"
```

---

### Task 9: `computeTestPerformance` query

**Files:**
- Create: `lib/db/queries/tests.ts`
- Create: `lib/db/queries/tests.test.ts`

**Interfaces:**
- Consumes: `testGrades`/`tests` tables (Task 1).
- Produces: `computeTestPerformance(studentId: string, schoolId: string | null): Promise<TestPerformanceEntry[]>` where `TestPerformanceEntry = { testId, title, subject, date, marksObtained: number | null, totalMarks: number, percentage: number | null, absent: boolean }`, ordered by `date` descending. Task 10 imports this.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/tests.test.ts`:

```ts
import { db } from '../index'
import { tests, testGrades, students } from '../schema'
import { computeTestPerformance } from './tests'

describe('computeTestPerformance', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
  })

  it('returns an empty list for a student with no grades', async () => {
    const result = await computeTestPerformance('00000000-0000-0000-0000-000000000000', null)
    expect(result).toEqual([])
  })

  it('returns graded entries ordered by date descending, with a computed percentage', async () => {
    const [student] = await db.insert(students).values({ name: 'Perf Student', batch: 'Batch A' }).returning()
    const [testEarly] = await db.insert(tests).values({ title: 'Early Test', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    const [testLate] = await db.insert(tests).values({ title: 'Late Test', batch: 'Batch A', subject: 'Chemistry', date: '2026-07-01', totalMarks: 50 }).returning()
    await db.insert(testGrades).values([
      { testId: testEarly.id, studentId: student.id, marksObtained: 80, absent: false },
      { testId: testLate.id, studentId: student.id, marksObtained: 25, absent: false },
    ])

    const result = await computeTestPerformance(student.id, null)
    expect(result.map(r => r.title)).toEqual(['Late Test', 'Early Test'])
    expect(result[0].percentage).toBe(50)
    expect(result[1].percentage).toBe(80)
  })

  it('reports absent entries with a null percentage', async () => {
    const [student] = await db.insert(students).values({ name: 'Absent Student', batch: 'Batch A' }).returning()
    const [test] = await db.insert(tests).values({ title: 'Missed Test', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    await db.insert(testGrades).values({ testId: test.id, studentId: student.id, absent: true })

    const result = await computeTestPerformance(student.id, null)
    expect(result).toHaveLength(1)
    expect(result[0].absent).toBe(true)
    expect(result[0].percentage).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/db/queries/tests.test.ts`
Expected: FAIL (module `./tests` does not exist).

- [ ] **Step 3: Implement**

Create `lib/db/queries/tests.ts`:

```ts
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../index'
import { testGrades, tests } from '../schema'

export interface TestPerformanceEntry {
  testId: string
  title: string
  subject: string
  date: string
  marksObtained: number | null
  totalMarks: number
  percentage: number | null
  absent: boolean
}

// Live per-student test performance, joined from test_grades/tests — never
// duplicated into student_report_entries, so grading changes are always
// reflected immediately in Student Reports.
export async function computeTestPerformance(
  studentId: string,
  schoolId: string | null
): Promise<TestPerformanceEntry[]> {
  if (!studentId) return []

  const conditions = [eq(testGrades.studentId, studentId)]
  if (schoolId) conditions.push(eq(testGrades.schoolId, schoolId))

  const rows = await db
    .select({
      testId: tests.id,
      title: tests.title,
      subject: tests.subject,
      date: tests.date,
      totalMarks: tests.totalMarks,
      marksObtained: testGrades.marksObtained,
      absent: testGrades.absent,
    })
    .from(testGrades)
    .innerJoin(tests, eq(testGrades.testId, tests.id))
    .where(and(...conditions))
    .orderBy(desc(tests.date))

  return rows.map(r => ({
    testId: r.testId,
    title: r.title,
    subject: r.subject,
    date: r.date,
    marksObtained: r.marksObtained,
    totalMarks: r.totalMarks,
    percentage: !r.absent && r.marksObtained !== null
      ? Math.round((r.marksObtained / r.totalMarks) * 1000) / 10
      : null,
    absent: r.absent,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/db/queries/tests.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/tests.ts lib/db/queries/tests.test.ts
git commit -m "feat: add computeTestPerformance query for live Student Reports integration"
```

---

### Task 10: Wire `computeTestPerformance` into the Student Reports and student-profile APIs

**Files:**
- Modify: `app/api/student-reports/[id]/route.ts`
- Modify: `app/api/teacher-portal/students/[id]/route.ts`

**Interfaces:**
- Consumes: `computeTestPerformance` (Task 9).
- Produces: `student-reports/[id]` entries gain `testAverage: number | null` and `testCount: number`. `teacher-portal/students/[id]`'s `recentTests` is now sourced from real `test_grades` data (shape unchanged: `{ test, date, score }`) instead of the unrelated bulk-uploaded `student_report_entries` table it was reading from before. Task 11 (UI) renders both.

- [ ] **Step 1: Add `testAverage`/`testCount` to `app/api/student-reports/[id]/route.ts`**

Find:

```ts
import { computeStudentAttendance, computeAssignmentAverage } from '@/lib/db/queries/attendance'
import { getLocalToday } from '@/lib/scheduleUtils'
```

Replace with:

```ts
import { computeStudentAttendance, computeAssignmentAverage } from '@/lib/db/queries/attendance'
import { computeTestPerformance } from '@/lib/db/queries/tests'
import { getLocalToday } from '@/lib/scheduleUtils'
```

Find:

```ts
    const todayIso = getLocalToday()
    const entries = await Promise.all(report.entries.map(async (e) => {
      const student = e.rollNo ? studentByRoll.get(e.rollNo) : undefined
      const [attendanceStats, assignmentStats] = student
        ? await Promise.all([
            computeStudentAttendance(student.id, student.batch, schoolId, todayIso),
            computeAssignmentAverage(student.id),
          ])
        : [null, null]

      return {
        name: e.name,
        rollNo: e.rollNo,
        marks: e.marks,
        maxMarks: e.maxMarks,
        grade: e.grade,
        attendance: attendanceStats ? attendanceStats.percentage : e.attendance,
        attendanceDetail: attendanceStats ? `${attendanceStats.presentCount}/${attendanceStats.totalClasses}` : null,
        assignmentAverage: assignmentStats ? assignmentStats.average : null,
        assignmentGradedCount: assignmentStats ? assignmentStats.gradedCount : 0,
        remarks: e.remarks,
      }
    }))
```

Replace with:

```ts
    const todayIso = getLocalToday()
    const entries = await Promise.all(report.entries.map(async (e) => {
      const student = e.rollNo ? studentByRoll.get(e.rollNo) : undefined
      const [attendanceStats, assignmentStats, testPerformance] = student
        ? await Promise.all([
            computeStudentAttendance(student.id, student.batch, schoolId, todayIso),
            computeAssignmentAverage(student.id),
            computeTestPerformance(student.id, schoolId),
          ])
        : [null, null, []]

      const gradedTests = testPerformance.filter(t => !t.absent && t.percentage !== null)
      const testAverage = gradedTests.length > 0
        ? Math.round(gradedTests.reduce((sum, t) => sum + (t.percentage as number), 0) / gradedTests.length)
        : null

      return {
        name: e.name,
        rollNo: e.rollNo,
        marks: e.marks,
        maxMarks: e.maxMarks,
        grade: e.grade,
        attendance: attendanceStats ? attendanceStats.percentage : e.attendance,
        attendanceDetail: attendanceStats ? `${attendanceStats.presentCount}/${attendanceStats.totalClasses}` : null,
        assignmentAverage: assignmentStats ? assignmentStats.average : null,
        assignmentGradedCount: assignmentStats ? assignmentStats.gradedCount : 0,
        testAverage,
        testCount: gradedTests.length,
        remarks: e.remarks,
      }
    }))
```

- [ ] **Step 2: Replace the `recentTests` source in `app/api/teacher-portal/students/[id]/route.ts`**

Find:

```ts
import { computeStudentAttendance } from '@/lib/db/queries/attendance'
import { getLocalToday } from '@/lib/scheduleUtils'
```

Replace with:

```ts
import { computeStudentAttendance } from '@/lib/db/queries/attendance'
import { computeTestPerformance } from '@/lib/db/queries/tests'
import { getLocalToday } from '@/lib/scheduleUtils'
```

Find:

```ts
    const recentTests = entries.map(e => ({
      test: `${e.term} - ${e.subject}`,
      date: new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: `${e.marks}/${e.maxMarks}`,
      percentage: Math.round((e.marks / e.maxMarks) * 100),
    }))
```

Replace with:

```ts
    // "Recent Tests" is about the real Tests & Question Bank feature, not
    // the unrelated bulk-uploaded student_report_entries used for
    // subjectAverages below — those are two different data sources that
    // happened to share this panel before test grading existed.
    const testPerformance = await computeTestPerformance(student.id, schoolId)
    const recentTests = testPerformance.map(t => ({
      test: `${t.title} (${t.subject})`,
      date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: t.absent ? 'Absent' : t.marksObtained !== null ? `${t.marksObtained}/${t.totalMarks}` : 'Pending',
      percentage: t.percentage,
    }))
```

- [ ] **Step 3: Write a focused test for the student-reports route change**

Create `app/api/student-reports/[id]/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students, tests, testGrades } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/queries/student-reports', () => ({
  getReportById: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { getReportById } from '@/lib/db/queries/student-reports'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/student-reports/[id] test performance', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('includes a computed testAverage per entry from real test_grades data', async () => {
    const [student] = await db.insert(students).values({ name: 'Report Student', rollNo: 'R1', class: '11 - A' }).returning()
    const [test] = await db.insert(tests).values({ title: 'Unit 1', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    await db.insert(testGrades).values({ testId: test.id, studentId: student.id, marksObtained: 90, absent: false })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'teacher-1', role: 'management', schoolId: null } })
    ;(getReportById as jest.Mock).mockResolvedValue({
      id: 'report-1', teacherId: 'teacher-1', teacherName: 'T', className: '11 - A', subject: 'Physics', term: 'Term 1',
      schoolId: null, createdAt: new Date(),
      entries: [{ name: 'Report Student', rollNo: 'R1', marks: 40, maxMarks: 50, grade: 'A', attendance: null, remarks: null }],
    })

    const res = await GET(req('http://localhost/api/student-reports/report-1'), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(body.entries[0].testAverage).toBe(90)
    expect(body.entries[0].testCount).toBe(1)
  })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/student-reports`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/student-reports/\[id\]/route.ts app/api/student-reports/\[id\]/route.test.ts app/api/teacher-portal/students/\[id\]/route.ts
git commit -m "feat: wire live test performance into student-reports and student-profile APIs"
```

---

### Task 11: Render test performance in the Student Reports UI

**Files:**
- Modify: `components/dashboard/ReportDetailModal.tsx`
- Modify: `components/dashboard/teacher/TeacherStudentRosterView.tsx`

**Interfaces:**
- Consumes: `testAverage`/`testCount` from `student-reports/[id]` and `recentTests` from `teacher-portal/students/[id]` (Task 10).

This component is shared by both the admin (`StudentReportsView.tsx`) and faculty (`TeacherStudentReportsView.tsx`) report list pages, so this one change covers both roles for that surface. `TeacherStudentRosterView.tsx`'s "Recent Tests" panel already exists and is already titled correctly — only its data source changed in Task 10, so no faculty-only tab exists there to update separately.

- [ ] **Step 1: Add a "Test Avg" column to `ReportDetailModal.tsx`**

Find:

```tsx
interface ReportEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number | null
  attendanceDetail: string | null
  assignmentAverage: number | null
  assignmentGradedCount: number
  remarks: string | null
}
```

Replace with:

```tsx
interface ReportEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number | null
  attendanceDetail: string | null
  assignmentAverage: number | null
  assignmentGradedCount: number
  testAverage: number | null
  testCount: number
  remarks: string | null
}
```

Find:

```tsx
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Roll No', 'Marks', 'Grade', 'Attendance', 'Assignment Avg', 'Remarks'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
```

Replace with:

```tsx
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'Roll No', 'Marks', 'Grade', 'Attendance', 'Assignment Avg', 'Test Avg', 'Remarks'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
```

Find:

```tsx
                      <td className="px-4 py-3 text-slate-600">
                        {e.assignmentAverage !== null ? `${e.assignmentAverage}%` : '—'}
                        {e.assignmentGradedCount > 0 && (
                          <span className="text-slate-400"> ({e.assignmentGradedCount} graded)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{e.remarks || '—'}</td>
```

Replace with:

```tsx
                      <td className="px-4 py-3 text-slate-600">
                        {e.assignmentAverage !== null ? `${e.assignmentAverage}%` : '—'}
                        {e.assignmentGradedCount > 0 && (
                          <span className="text-slate-400"> ({e.assignmentGradedCount} graded)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {e.testAverage !== null ? `${e.testAverage}%` : '—'}
                        {e.testCount > 0 && (
                          <span className="text-slate-400"> ({e.testCount} test{e.testCount === 1 ? '' : 's'})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{e.remarks || '—'}</td>
```

- [ ] **Step 2: Verify `TeacherStudentRosterView.tsx` needs no JSX change**

The "Recent Tests" table (`studentDetails.recentTests.map(...)`) already renders `t.test`/`t.date`/`t.score` exactly as Task 10's new `recentTests` shape provides them — no JSX change is required here, only confirm the data now reflects real tests. Run the manual check in Step 3 below to confirm this.

- [ ] **Step 3: Typecheck and manual verification**

Run: `npx tsc --noEmit`
Expected: no errors.

On the dev server:
1. As a teacher, grade a test for a real student (Task 8's Grade action).
2. Open that student's profile in the faculty Students roster (`TeacherStudentRosterView.tsx`) — confirm "Recent Tests" now shows the graded test with its real score, not stale/unrelated bulk-report data.
3. As management, open a Student Report's detail view (`ReportDetailModal.tsx`) for a student who has been graded on at least one test — confirm the new "Test Avg" column shows the computed percentage.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ReportDetailModal.tsx
git commit -m "feat: show live test performance in Student Reports UI"
```

---

## Final Verification

- [ ] Run: `npm test` — every suite passes.
- [ ] Run: `npx tsc --noEmit` — no errors.
- [ ] Run: `npm run build` — production build succeeds.
- [ ] Manual pass on the dev server covering the full spec: a teacher creates a test + question, another teacher never sees them; management sees both plus legacy rows; a teacher attaches a test paper and management can preview it but a different teacher cannot; grading is blocked until the test date arrives, then produces a percentage/rank; a graded test's score appears live in that student's report views on both sides.
