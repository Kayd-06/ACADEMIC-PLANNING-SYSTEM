# Automated Student Class Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual, per-student `class` edits with an automated, per-school, per-academic-year promotion cycle: a daily cron job detects when a school has crossed its academic-year boundary, computes which students are due to move up a class, and surfaces that as a reviewable, confirm/dismiss-gated action in the UI — never a silent bulk write.

**Architecture:** A new `academicYearStartMonth` column on `schools` plus two new tables (`class_promotion_runs`, `class_promotion_log`) back a three-part flow: (1) a Vercel Cron-triggered detection endpoint that idempotently creates one `pending` run per school per academic year and notifies management, (2) a management-only "Promotion" tab that shows the pending run as a review banner with confirm/dismiss actions plus a history list, and (3) confirm/dismiss endpoints where confirm re-validates eligibility fresh, bumps `class`, clears `batch`, marks the matching `student_batch_enrollments` row `completed`, and writes an audit log row per student.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM (`drizzle-orm/neon-http`) against Neon Postgres, NextAuth `auth()` sessions, Jest against the shared live dev database (`maxWorkers: 1`, no per-test DB isolation).

## Global Constraints

- **No `db.transaction()`.** `drizzle-orm/neon-http`'s driver throws `"No transactions support in neon-http driver"` at runtime (confirmed by inspecting `node_modules/drizzle-orm/neon-http/session.cjs`). Every multi-row write in this plan (the confirm endpoint's per-student loop) is a sequential `for` loop with no transaction wrapper, matching the existing convention in `app/api/teacher-portal/faculty/bulk/route.ts` and `app/api/fees/bulk-import/route.ts`. This is a deliberate deviation from the design spec's literal wording ("In a single DB transaction") — the driver cannot do that, so a sequential loop is the closest available behavior.
- **Auth pattern:** every route handler does `const session = await auth(); if (!session) return 401; if ((session.user as any).role !== 'management') return 403;` — the exact pattern already used in `app/api/admin/schools/route.ts` and `app/api/programs/route.ts`.
- **School scoping:** `class_promotion_runs`/`class_promotion_log` are new tables introduced after multi-tenancy already existed, so unlike some legacy tables their `schoolId` scoping does not need a `schoolId ? eq(...) : isNull(...)` fallback — a management user with no active school (`schoolId` null) simply sees/can act on no promotion data.
- **Promotion chain is hardcoded and terminal:** `{'9': '10', '10': '11', '11': '12'}`. Class `'12'` and `'Repeater'` never auto-promote — matches `CLASS_LEVELS` in `components/dashboard/management/BatchesTab.tsx` / `app/api/batches/route.ts`.
- **Migrations are hand-written, not `drizzle-kit generate`-produced.** This repo's `lib/db/migrations/*.sql` files use hand-picked descriptive names (`0032_school_phone.sql`, not drizzle-kit's auto-generated adjective-noun names) and are registered by manually appending an entry to `lib/db/migrations/meta/_journal.json`. Follow that exact convention for the new migration.
- **No component-level tests exist anywhere in this codebase** (`components/dashboard/**` has zero `.test.tsx` files). UI-only tasks in this plan (the Promotion tab, School Settings form fields, tab-visibility wiring) are verified by `npx tsc --noEmit -p .` and a manual dev-server check, not a Jest test — this matches, rather than deviates from, established practice.
- **Jest hits one shared live Neon Postgres DB** (`jest.config.ts` sets `maxWorkers: 1`; there is no per-test database isolation). Every new test in this plan cleans up with **scoped** deletes (`.where(eq(table.schoolId, createdSchoolId))` etc.), never an unscoped `db.delete(table)` — unscoped deletes on guarded tables (`users|schools|students|tests|questions|student_reports|student_report_entries|test_grades`, per `lib/db/dbGuard.ts`) are silently no-op'd by the DB guard anyway, so they wouldn't even clean up. The cron endpoint's test additionally has to protect the shared DB's *other, real* school rows from the endpoint's "loop over every active school" behavior — see Task 3.

---

### Task 1: Pure eligibility and date-boundary logic

**Files:**
- Create: `lib/classPromotion.ts`
- Test: `lib/classPromotion.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no DB).
- Produces (used by Tasks 2, 3, 5):
  - `NEXT_CLASS: Record<string, string>` — `{'9': '10', '10': '11', '11': '12'}`
  - `interface PromotionCandidate { class: string; admissionDate: string | null; isActive: boolean }`
  - `computeBoundaryDate(academicYearStartMonth: number, today?: Date): string` — returns `YYYY-MM-01`
  - `subtractOneYear(dateStr: string): string` — `YYYY-MM-DD` in, one year earlier out
  - `computeAcademicYearLabel(boundaryDate: string): string` — `"2027-2028"` from `"2027-04-01"`
  - `isEligibleForPromotion(student: PromotionCandidate, previousBoundaryDate: string): boolean`
  - `interface PreviewCounts { [fromClass: string]: { [toClass: string]: number } }`
  - `buildPreviewCounts(eligibleStudents: { class: string }[]): PreviewCounts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/classPromotion.test.ts
import {
  computeBoundaryDate,
  subtractOneYear,
  computeAcademicYearLabel,
  isEligibleForPromotion,
  buildPreviewCounts,
} from './classPromotion'

describe('computeBoundaryDate', () => {
  it("returns this year's boundary when today is on or after the start month", () => {
    const today = new Date(Date.UTC(2027, 5, 15)) // June 2027, start month April (4)
    expect(computeBoundaryDate(4, today)).toBe('2027-04-01')
  })

  it("returns last year's boundary when today is before the start month", () => {
    const today = new Date(Date.UTC(2027, 1, 10)) // February 2027, start month April (4)
    expect(computeBoundaryDate(4, today)).toBe('2026-04-01')
  })

  it('handles a January start month', () => {
    const today = new Date(Date.UTC(2027, 0, 1)) // Jan 1, 2027
    expect(computeBoundaryDate(1, today)).toBe('2027-01-01')
  })
})

describe('subtractOneYear', () => {
  it('subtracts one year from a YYYY-MM-DD date', () => {
    expect(subtractOneYear('2027-04-01')).toBe('2026-04-01')
  })
})

describe('computeAcademicYearLabel', () => {
  it('builds a YYYY-YYYY label from the boundary date', () => {
    expect(computeAcademicYearLabel('2027-04-01')).toBe('2027-2028')
  })
})

describe('isEligibleForPromotion', () => {
  const previousBoundaryDate = '2026-04-01'

  it('is eligible when admitted before the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-03-31', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(true)
  })

  it('is NOT eligible when admitted exactly on the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-04-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible when admitted one day after the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-04-02', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is eligible with a null admissionDate (pre-existing data with no recorded date)', () => {
    const student = { class: '9', admissionDate: null, isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(true)
  })

  it('is NOT eligible for Class 12 (terminal, no next class)', () => {
    const student = { class: '12', admissionDate: '2020-01-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible for Repeater', () => {
    const student = { class: 'Repeater', admissionDate: '2020-01-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible when inactive', () => {
    const student = { class: '9', admissionDate: '2020-01-01', isActive: false }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })
})

describe('buildPreviewCounts', () => {
  it('groups eligible students by fromClass -> toClass -> count', () => {
    const eligible = [{ class: '9' }, { class: '9' }, { class: '10' }]
    expect(buildPreviewCounts(eligible)).toEqual({ '9': { '10': 2 }, '10': { '11': 1 } })
  })

  it('returns an empty object for no eligible students', () => {
    expect(buildPreviewCounts([])).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/classPromotion.test.ts`
Expected: FAIL with `Cannot find module './classPromotion'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/classPromotion.ts
export const NEXT_CLASS: Record<string, string> = { '9': '10', '10': '11', '11': '12' }

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function computeBoundaryDate(academicYearStartMonth: number, today: Date = new Date()): string {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1 // 1-12
  const boundaryYear = month >= academicYearStartMonth ? year : year - 1
  return `${boundaryYear}-${pad2(academicYearStartMonth)}-01`
}

export function subtractOneYear(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y - 1}-${pad2(m)}-${pad2(d)}`
}

export function computeAcademicYearLabel(boundaryDate: string): string {
  const [y] = boundaryDate.split('-').map(Number)
  return `${y}-${y + 1}`
}

export interface PromotionCandidate {
  class: string
  admissionDate: string | null
  isActive: boolean
}

// A student with no recorded admissionDate is treated as admitted before the
// boundary (eligible), not permanently excluded — most pre-existing student
// rows predate this feature and have no reliable admission date on file.
export function isEligibleForPromotion(student: PromotionCandidate, previousBoundaryDate: string): boolean {
  if (!student.isActive) return false
  if (!(student.class in NEXT_CLASS)) return false
  if (!student.admissionDate) return true
  return student.admissionDate < previousBoundaryDate
}

export interface PreviewCounts {
  [fromClass: string]: { [toClass: string]: number }
}

export function buildPreviewCounts(eligibleStudents: { class: string }[]): PreviewCounts {
  const counts: PreviewCounts = {}
  for (const s of eligibleStudents) {
    const next = NEXT_CLASS[s.class]
    if (!next) continue
    counts[s.class] = counts[s.class] || {}
    counts[s.class][next] = (counts[s.class][next] || 0) + 1
  }
  return counts
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/classPromotion.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/classPromotion.ts lib/classPromotion.test.ts
git commit -m "feat: add pure eligibility and academic-year boundary logic for class promotion"
```

---

### Task 2: Schema, migration, and DB-backed query helpers

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0033_class_promotion.sql`
- Modify: `lib/db/migrations/meta/_journal.json`
- Create: `lib/db/queries/classPromotion.ts`
- Test: `lib/db/queries/classPromotion.test.ts`

**Interfaces:**
- Consumes: `isEligibleForPromotion`, `PromotionCandidate` from Task 1's `lib/classPromotion.ts`.
- Produces (used by Tasks 3, 4, 5, 6, 7):
  - Schema: `schools.academicYearStartMonth: integer` (default 4), `classPromotionRuns` table + `ClassPromotionRun`/`NewClassPromotionRun` types, `classPromotionLog` table + `ClassPromotionLog`/`NewClassPromotionLog` types.
  - `getEligibleStudents(schoolId: string, previousBoundaryDate: string): Promise<EligibleStudent[]>` where `interface EligibleStudent extends PromotionCandidate { id: string; batch: string }`
  - `getExcludedNewAdmissionCount(schoolId: string, previousBoundaryDate: string): Promise<number>`
  - `getActiveClass12Count(schoolId: string): Promise<number>`
  - `getManagementUserIds(schoolId: string): Promise<string[]>`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/db/queries/classPromotion.test.ts
import { eq } from 'drizzle-orm'
import { db } from '../index'
import { students, schools, users } from '../schema'
import {
  getEligibleStudents,
  getExcludedNewAdmissionCount,
  getActiveClass12Count,
  getManagementUserIds,
} from './classPromotion'

describe('classPromotion queries', () => {
  const schoolIds: string[] = []

  afterEach(async () => {
    for (const schoolId of schoolIds) {
      await db.delete(students).where(eq(students.schoolId, schoolId))
      await db.delete(users).where(eq(users.schoolId, schoolId))
      await db.delete(schools).where(eq(schools.id, schoolId))
    }
    schoolIds.length = 0
  })

  it('getEligibleStudents returns only active 9/10/11 students admitted before the boundary', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'Old Enough', class: '9', admissionDate: '2025-01-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Too New', class: '9', admissionDate: '2026-06-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Class 12', class: '12', admissionDate: '2020-01-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Inactive', class: '9', admissionDate: '2020-01-01', schoolId: school.id, isActive: false })

    const result = await getEligibleStudents(school.id, '2026-04-01')
    expect(result.map((s) => s.class)).toEqual(['9'])
  })

  it('getExcludedNewAdmissionCount counts active 9/10/11 students admitted on/after the boundary', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'New Admission', class: '10', admissionDate: '2026-04-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Old Admission', class: '10', admissionDate: '2020-01-01', schoolId: school.id, isActive: true })

    const count = await getExcludedNewAdmissionCount(school.id, '2026-04-01')
    expect(count).toBe(1)
  })

  it('getActiveClass12Count counts only active Class 12 students', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'Active 12', class: '12', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Inactive 12', class: '12', schoolId: school.id, isActive: false })
    await db.insert(students).values({ name: 'Active 11', class: '11', schoolId: school.id, isActive: true })

    const count = await getActiveClass12Count(school.id)
    expect(count).toBe(1)
  })

  it('getManagementUserIds returns only management-role users of the given school', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    await db.insert(users).values({
      name: 'Teacher', email: `tch-${Date.now()}@test.com`, password: 'x', role: 'teacher', schoolId: school.id,
    })

    const ids = await getManagementUserIds(school.id)
    expect(ids).toEqual([manager.id])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/db/queries/classPromotion.test.ts`
Expected: FAIL with `Cannot find module './classPromotion'`

- [ ] **Step 3: Add the schema, write and register the migration, write the query helpers**

Modify `lib/db/schema.ts` — add `jsonb` to the pg-core import on line 2:

```typescript
import { pgTable, uuid, text, varchar, timestamp, pgEnum, boolean, uniqueIndex, integer, jsonb } from 'drizzle-orm/pg-core'
```

Add `academicYearStartMonth` to the `schools` table (insert right after the `isActive` field, i.e. between lines 74 and 75 of the current file):

```typescript
  isActive: boolean('is_active').notNull().default(true),
  academicYearStartMonth: integer('academic_year_start_month').notNull().default(4),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

Add the two new tables right after `export type NewSubject = typeof subjects.$inferInsert` (after the existing `subjects` table block, before the `// Program -> Subject mapping` comment):

```typescript
// One row per detected academic-year boundary for a school. The unique
// index on (schoolId, academicYear) is the idempotency guard that stops the
// daily cron from creating duplicate runs for a boundary already detected.
export const classPromotionRuns = pgTable('class_promotion_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  academicYear: varchar('academic_year', { length: 255 }).notNull(),
  boundaryDate: varchar('boundary_date', { length: 10 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | confirmed | dismissed
  previewCounts: jsonb('preview_counts').$type<Record<string, Record<string, number>>>().notNull().default({}),
  excludedNewAdmissionCount: integer('excluded_new_admission_count').notNull().default(0),
  excludedTerminalCount: integer('excluded_terminal_count').notNull().default(0),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  schoolYearUnique: uniqueIndex('class_promotion_runs_school_year_unique').on(table.schoolId, table.academicYear),
}))

export type ClassPromotionRun = typeof classPromotionRuns.$inferSelect
export type NewClassPromotionRun = typeof classPromotionRuns.$inferInsert

// One row per student actually promoted when a run is confirmed — the audit trail.
export const classPromotionLog = pgTable('class_promotion_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => classPromotionRuns.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  fromClass: varchar('from_class', { length: 255 }).notNull(),
  toClass: varchar('to_class', { length: 255 }).notNull(),
  previousBatch: varchar('previous_batch', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ClassPromotionLog = typeof classPromotionLog.$inferSelect
export type NewClassPromotionLog = typeof classPromotionLog.$inferInsert
```

Create `lib/db/migrations/0033_class_promotion.sql`:

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_year_start_month integer NOT NULL DEFAULT 4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS class_promotion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  academic_year varchar(255) NOT NULL,
  boundary_date varchar(10) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  preview_counts jsonb NOT NULL DEFAULT '{}',
  excluded_new_admission_count integer NOT NULL DEFAULT 0,
  excluded_terminal_count integer NOT NULL DEFAULT 0,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS class_promotion_runs_school_year_unique ON class_promotion_runs(school_id, academic_year);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS class_promotion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES class_promotion_runs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class varchar(255) NOT NULL,
  to_class varchar(255) NOT NULL,
  previous_batch varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Modify `lib/db/migrations/meta/_journal.json` — append a new entry to the `entries` array (after the `0032_school_phone` entry):

```json
    {
      "idx": 19,
      "version": "7",
      "when": 1784955600000,
      "tag": "0033_class_promotion",
      "breakpoints": true
    }
```

Create `lib/db/queries/classPromotion.ts`:

```typescript
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, users } from '../schema'
import { isEligibleForPromotion, type PromotionCandidate } from '@/lib/classPromotion'

export interface EligibleStudent extends PromotionCandidate {
  id: string
  batch: string
}

export async function getEligibleStudents(schoolId: string, previousBoundaryDate: string): Promise<EligibleStudent[]> {
  const rows = await db
    .select({ id: students.id, class: students.class, admissionDate: students.admissionDate, batch: students.batch, isActive: students.isActive })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), inArray(students.class, ['9', '10', '11'])))
  return rows.filter((s) => isEligibleForPromotion(s, previousBoundaryDate))
}

export async function getExcludedNewAdmissionCount(schoolId: string, previousBoundaryDate: string): Promise<number> {
  const rows = await db
    .select({ admissionDate: students.admissionDate })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), inArray(students.class, ['9', '10', '11'])))
  return rows.filter((r) => !!r.admissionDate && r.admissionDate >= previousBoundaryDate).length
}

export async function getActiveClass12Count(schoolId: string): Promise<number> {
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), eq(students.class, '12')))
  return rows.length
}

export async function getManagementUserIds(schoolId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, 'management')))
  return rows.map((r) => r.id)
}
```

Run the migration:

```bash
npm run db:migrate
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/db/queries/classPromotion.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/0033_class_promotion.sql lib/db/migrations/meta/_journal.json lib/db/queries/classPromotion.ts lib/db/queries/classPromotion.test.ts
git commit -m "feat: add academicYearStartMonth column, class_promotion tables, and query helpers"
```

---

### Task 3: Cron detection endpoint

**Files:**
- Create: `app/api/cron/class-promotion/route.ts`
- Test: `app/api/cron/class-promotion/route.test.ts`
- Create: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `computeBoundaryDate`, `subtractOneYear`, `computeAcademicYearLabel`, `buildPreviewCounts` from Task 1; `getEligibleStudents`, `getExcludedNewAdmissionCount`, `getActiveClass12Count`, `getManagementUserIds` from Task 2; `classPromotionRuns`, `schools`, `notifications` from `lib/db/schema`.
- Produces: `GET` handler at `/api/cron/class-promotion` returning `{ runsCreated: number }`; a `CRON_SECRET` env var; a Vercel Cron schedule.

Note on testing this endpoint: it loops over **every school where `isActive = true`**, with no filter. Since Jest hits the same shared, live dev database this app itself runs against, a naive test would create real `class_promotion_runs` rows and fire real "promotion ready" notifications for whatever real schools already exist there. The test below temporarily deactivates every other currently-active school for its duration and restores them afterward, so the cron run only ever sees the one school the test itself created.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/cron/class-promotion/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, classPromotionRuns, notifications } from '@/lib/db/schema'
import { NextRequest } from 'next/server'
import { GET } from './route'

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/class-promotion', { headers })
}

describe('GET /api/cron/class-promotion', () => {
  const createdSchoolIds: string[] = []
  let reactivatedSchoolIds: string[] = []

  beforeEach(async () => {
    process.env.CRON_SECRET = 'test-secret'
    // This endpoint scans every school with isActive = true. On the shared
    // dev database that would create real class_promotion_runs rows and
    // fire real notifications for schools that have nothing to do with
    // this test. Deactivate every other active school for the test's
    // duration and restore them in afterEach.
    const others = await db.select({ id: schools.id }).from(schools).where(eq(schools.isActive, true))
    reactivatedSchoolIds = others.map((o) => o.id)
    for (const id of reactivatedSchoolIds) {
      await db.update(schools).set({ isActive: false }).where(eq(schools.id, id))
    }
  })

  afterEach(async () => {
    for (const id of reactivatedSchoolIds) {
      await db.update(schools).set({ isActive: true }).where(eq(schools.id, id))
    }
    reactivatedSchoolIds = []
    for (const id of createdSchoolIds) {
      await db.delete(notifications).where(eq(notifications.schoolId, id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.schoolId, id))
      await db.delete(users).where(eq(users.schoolId, id))
      await db.delete(schools).where(eq(schools.id, id))
    }
    createdSchoolIds.length = 0
    delete process.env.CRON_SECRET
  })

  it('rejects a request without the correct bearer token', async () => {
    const res = await GET(req({ authorization: 'Bearer wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('creates exactly one pending run and notification on first call, and none on a same-day retry', async () => {
    const [school] = await db.insert(schools).values({ isActive: true, academicYearStartMonth: 4 }).returning()
    createdSchoolIds.push(school.id)
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()

    const first = await GET(req({ authorization: 'Bearer test-secret' }))
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.runsCreated).toBe(1)

    const runs = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('pending')

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, manager.id))
    expect(notifs).toHaveLength(1)

    const second = await GET(req({ authorization: 'Bearer test-secret' }))
    const secondBody = await second.json()
    expect(secondBody.runsCreated).toBe(0)

    const runsAfterRetry = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
    expect(runsAfterRetry).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/cron/class-promotion/route.test.ts`
Expected: FAIL with `Cannot find module './route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/cron/class-promotion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schools, classPromotionRuns, notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { computeBoundaryDate, subtractOneYear, computeAcademicYearLabel, buildPreviewCounts } from '@/lib/classPromotion'
import {
  getEligibleStudents,
  getExcludedNewAdmissionCount,
  getActiveClass12Count,
  getManagementUserIds,
} from '@/lib/db/queries/classPromotion'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeSchools = await db
    .select({ id: schools.id, academicYearStartMonth: schools.academicYearStartMonth })
    .from(schools)
    .where(eq(schools.isActive, true))

  let runsCreated = 0
  for (const school of activeSchools) {
    const boundaryDate = computeBoundaryDate(school.academicYearStartMonth)
    const academicYear = computeAcademicYearLabel(boundaryDate)

    const existing = await db
      .select({ id: classPromotionRuns.id })
      .from(classPromotionRuns)
      .where(and(eq(classPromotionRuns.schoolId, school.id), eq(classPromotionRuns.academicYear, academicYear)))
    if (existing.length > 0) continue

    const previousBoundaryDate = subtractOneYear(boundaryDate)
    const eligible = await getEligibleStudents(school.id, previousBoundaryDate)
    const excludedNewAdmissionCount = await getExcludedNewAdmissionCount(school.id, previousBoundaryDate)
    const excludedTerminalCount = await getActiveClass12Count(school.id)
    const previewCounts = buildPreviewCounts(eligible)

    await db.insert(classPromotionRuns).values({
      schoolId: school.id,
      academicYear,
      boundaryDate,
      status: 'pending',
      previewCounts,
      excludedNewAdmissionCount,
      excludedTerminalCount,
    })
    runsCreated++

    const managementUserIds = await getManagementUserIds(school.id)
    for (const userId of managementUserIds) {
      await db.insert(notifications).values({
        userId,
        category: 'General',
        title: 'Class promotion ready for review',
        message: `${academicYear} class promotion is ready to review for your school.`,
        link: '/management/academic-planning?tab=Promotion',
        schoolId: school.id,
      })
    }
  }

  return NextResponse.json({ runsCreated })
}
```

Create `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/class-promotion", "schedule": "0 3 * * *" }
  ]
}
```

Modify `.env.example` — append:

```
# Bearer token Vercel Cron sends as `Authorization: Bearer $CRON_SECRET` — required by /api/cron/class-promotion
CRON_SECRET=your_cron_secret_here
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/cron/class-promotion/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/class-promotion/route.ts app/api/cron/class-promotion/route.test.ts vercel.json .env.example
git commit -m "feat: add daily cron endpoint to detect class-promotion boundaries per school"
```

---

### Task 4: Promotions list endpoint

**Files:**
- Create: `app/api/academic-planning/promotions/route.ts`
- Test: `app/api/academic-planning/promotions/route.test.ts`

**Interfaces:**
- Consumes: `classPromotionRuns`, `classPromotionLog`, `users` from `lib/db/schema` (Task 2).
- Produces: `GET` handler at `/api/academic-planning/promotions` returning `{ pending: PromotionRunView | null, history: PromotionRunView[] }` where `PromotionRunView` is a `classPromotionRuns` row plus `promotedCount: number` and `confirmedByName: string | null`. Consumed by Task 8's `PromotionTab.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/academic-planning/promotions/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, students, classPromotionRuns, classPromotionLog } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { GET } from './route'

describe('GET /api/academic-planning/promotions', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns an empty payload when no school is active', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ pending: null, history: [] })
  })

  it('returns the pending run and separates confirmed history with promotedCount', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({ name: 'Student', class: '10', schoolId: school.id }).returning()

    const [pendingRun] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    const [confirmedRun] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2026-2027', boundaryDate: '2026-04-01', status: 'confirmed',
      previewCounts: { '9': { '10': 1 } }, confirmedAt: new Date(), confirmedBy: manager.id,
    }).returning()
    await db.insert(classPromotionLog).values({
      runId: confirmedRun.id, studentId: student.id, fromClass: '9', toClass: '10',
    })

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await GET()
      const body = await res.json()

      expect(body.pending.id).toBe(pendingRun.id)
      expect(body.history).toHaveLength(1)
      expect(body.history[0].id).toBe(confirmedRun.id)
      expect(body.history[0].promotedCount).toBe(1)
      expect(body.history[0].confirmedByName).toBe('Manager')
    } finally {
      await db.delete(classPromotionLog).where(eq(classPromotionLog.runId, confirmedRun.id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.schoolId, school.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/academic-planning/promotions/route.test.ts`
Expected: FAIL with `Cannot find module './route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/academic-planning/promotions/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ pending: null, history: [] })

  const runs = await db
    .select({
      id: classPromotionRuns.id,
      academicYear: classPromotionRuns.academicYear,
      boundaryDate: classPromotionRuns.boundaryDate,
      status: classPromotionRuns.status,
      previewCounts: classPromotionRuns.previewCounts,
      excludedNewAdmissionCount: classPromotionRuns.excludedNewAdmissionCount,
      excludedTerminalCount: classPromotionRuns.excludedTerminalCount,
      confirmedAt: classPromotionRuns.confirmedAt,
      confirmedBy: classPromotionRuns.confirmedBy,
      createdAt: classPromotionRuns.createdAt,
      confirmedByName: users.name,
    })
    .from(classPromotionRuns)
    .leftJoin(users, eq(classPromotionRuns.confirmedBy, users.id))
    .where(eq(classPromotionRuns.schoolId, schoolId))
    .orderBy(classPromotionRuns.createdAt)

  const runIds = runs.map((r) => r.id)
  const logRows = runIds.length > 0
    ? await db.select({ runId: classPromotionLog.runId }).from(classPromotionLog).where(inArray(classPromotionLog.runId, runIds))
    : []

  const promotedCountByRunId = new Map<string, number>()
  for (const row of logRows) {
    promotedCountByRunId.set(row.runId, (promotedCountByRunId.get(row.runId) ?? 0) + 1)
  }

  const result = runs.map((run) => ({ ...run, promotedCount: promotedCountByRunId.get(run.id) ?? 0 }))
  const pending = result.find((r) => r.status === 'pending') ?? null
  const history = result.filter((r) => r.status !== 'pending')

  return NextResponse.json({ pending, history })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/academic-planning/promotions/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/academic-planning/promotions/route.ts app/api/academic-planning/promotions/route.test.ts
git commit -m "feat: add promotions list endpoint with pending run and confirmed history"
```

---

### Task 5: Confirm endpoint

**Files:**
- Create: `app/api/academic-planning/promotions/[runId]/confirm/route.ts`
- Test: `app/api/academic-planning/promotions/[runId]/confirm/route.test.ts`

**Interfaces:**
- Consumes: `NEXT_CLASS`, `subtractOneYear` from Task 1; `getEligibleStudents` from Task 2; `classPromotionRuns`, `classPromotionLog`, `students`, `studentBatchEnrollments` from `lib/db/schema`.
- Produces: `POST` handler at `/api/academic-planning/promotions/[runId]/confirm` returning `{ promotedCount: number }`. Consumed by Task 8's `PromotionTab.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/academic-planning/promotions/[runId]/confirm/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, students, studentBatchEnrollments, classPromotionRuns, classPromotionLog } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req() {
  return new Request('http://localhost/api/academic-planning/promotions/x/confirm', { method: 'POST' })
}

describe('POST /api/academic-planning/promotions/[runId]/confirm', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await POST(req(), { params: Promise.resolve({ runId: 'any' }) })
    expect(res.status).toBe(403)
  })

  it('promotes eligible students, clears batch, completes enrollment, logs the change, and leaves Class 12/Repeater untouched', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({
      name: 'Promotable', class: '9', batch: 'Morning', admissionDate: '2025-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [enrollment] = await db.insert(studentBatchEnrollments).values({
      studentId: student.id, batchName: 'Morning', status: 'active',
    }).returning()
    const [class12Student] = await db.insert(students).values({
      name: 'Twelfth', class: '12', batch: 'Evening', admissionDate: '2020-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [repeaterStudent] = await db.insert(students).values({
      name: 'Repeats', class: 'Repeater', batch: 'Evening', admissionDate: '2020-01-01', schoolId: school.id, isActive: true,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.promotedCount).toBe(1)

      const [updatedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(updatedStudent.class).toBe('10')
      expect(updatedStudent.batch).toBe('')

      const [updatedEnrollment] = await db.select().from(studentBatchEnrollments).where(eq(studentBatchEnrollments.id, enrollment.id))
      expect(updatedEnrollment.status).toBe('completed')

      const logs = await db.select().from(classPromotionLog).where(eq(classPromotionLog.runId, run.id))
      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({ studentId: student.id, fromClass: '9', toClass: '10', previousBatch: 'Morning' })

      const [updatedRun] = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      expect(updatedRun.status).toBe('confirmed')
      expect(updatedRun.confirmedBy).toBe(manager.id)

      const [unchangedClass12] = await db.select().from(students).where(eq(students.id, class12Student.id))
      expect(unchangedClass12.class).toBe('12')
      expect(unchangedClass12.batch).toBe('Evening')

      const [unchangedRepeater] = await db.select().from(students).where(eq(students.id, repeaterStudent.id))
      expect(unchangedRepeater.class).toBe('Repeater')
      expect(unchangedRepeater.batch).toBe('Evening')
    } finally {
      await db.delete(classPromotionLog).where(eq(classPromotionLog.runId, run.id))
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(studentBatchEnrollments).where(eq(studentBatchEnrollments.studentId, student.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('skips a student who was deactivated between detection and confirm (re-validates eligibility)', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [student] = await db.insert(students).values({
      name: 'Deactivated', class: '9', batch: 'Morning', admissionDate: '2025-01-01', schoolId: school.id, isActive: false,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending',
      previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      const body = await res.json()
      expect(body.promotedCount).toBe(0)

      const [unchangedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(unchangedStudent.class).toBe('9')
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('rejects confirming a run that is already confirmed', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'confirmed', previewCounts: {},
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(400)
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(users).where(eq(users.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/academic-planning/promotions/\[runId\]/confirm/route.test.ts`
Expected: FAIL with `Cannot find module './route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/academic-planning/promotions/[runId]/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, students, studentBatchEnrollments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { NEXT_CLASS, subtractOneYear } from '@/lib/classPromotion'
import { getEligibleStudents } from '@/lib/db/queries/classPromotion'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runId } = await params
  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

  const [run] = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.id, runId))
  if (!run || run.schoolId !== schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'pending') return NextResponse.json({ error: `Run is already ${run.status}` }, { status: 400 })

  // Re-run eligibility fresh rather than trusting the run's stored
  // previewCounts — a student's class/status/admission date may have
  // changed since detection.
  const previousBoundaryDate = subtractOneYear(run.boundaryDate)
  const eligible = await getEligibleStudents(schoolId, previousBoundaryDate)

  let promotedCount = 0
  for (const student of eligible) {
    const nextClass = NEXT_CLASS[student.class]
    if (!nextClass) continue

    const previousBatch = student.batch || null

    await db.update(students).set({ class: nextClass, batch: '', updatedAt: new Date() }).where(eq(students.id, student.id))

    if (previousBatch) {
      await db
        .update(studentBatchEnrollments)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(
          eq(studentBatchEnrollments.studentId, student.id),
          eq(studentBatchEnrollments.batchName, previousBatch),
          eq(studentBatchEnrollments.status, 'active'),
        ))
    }

    await db.insert(classPromotionLog).values({
      runId: run.id,
      studentId: student.id,
      fromClass: student.class,
      toClass: nextClass,
      previousBatch,
    })

    promotedCount++
  }

  await db
    .update(classPromotionRuns)
    .set({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: session.user.id! })
    .where(eq(classPromotionRuns.id, run.id))

  return NextResponse.json({ promotedCount })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/academic-planning/promotions/\[runId\]/confirm/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/academic-planning/promotions/[runId]/confirm/route.ts" "app/api/academic-planning/promotions/[runId]/confirm/route.test.ts"
git commit -m "feat: add class-promotion confirm endpoint with fresh re-validation and audit log"
```

---

### Task 6: Dismiss endpoint

**Files:**
- Create: `app/api/academic-planning/promotions/[runId]/dismiss/route.ts`
- Test: `app/api/academic-planning/promotions/[runId]/dismiss/route.test.ts`

**Interfaces:**
- Consumes: `classPromotionRuns` from `lib/db/schema` (Task 2).
- Produces: `POST` handler at `/api/academic-planning/promotions/[runId]/dismiss` returning the updated run row. Consumed by Task 8's `PromotionTab.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/academic-planning/promotions/[runId]/dismiss/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, classPromotionRuns } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req() {
  return new Request('http://localhost/api/academic-planning/promotions/x/dismiss', { method: 'POST' })
}

describe('POST /api/academic-planning/promotions/[runId]/dismiss', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: 'x' } })
    const res = await POST(req(), { params: Promise.resolve({ runId: 'any' }) })
    expect(res.status).toBe(403)
  })

  it('marks a pending run as dismissed without touching any student data', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [student] = await db.insert(students).values({ name: 'Untouched', class: '9', schoolId: school.id }).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'pending', previewCounts: { '9': { '10': 1 } },
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('dismissed')

      const [unchangedStudent] = await db.select().from(students).where(eq(students.id, student.id))
      expect(unchangedStudent.class).toBe('9')
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(students).where(eq(students.schoolId, school.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })

  it('rejects dismissing a run that is not pending', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    const [run] = await db.insert(classPromotionRuns).values({
      schoolId: school.id, academicYear: '2027-2028', boundaryDate: '2027-04-01', status: 'dismissed', previewCounts: {},
    }).returning()

    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
      const res = await POST(req(), { params: Promise.resolve({ runId: run.id }) })
      expect(res.status).toBe(400)
    } finally {
      await db.delete(classPromotionRuns).where(eq(classPromotionRuns.id, run.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/academic-planning/promotions/\[runId\]/dismiss/route.test.ts`
Expected: FAIL with `Cannot find module './route'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/api/academic-planning/promotions/[runId]/dismiss/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runId } = await params
  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

  const [run] = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.id, runId))
  if (!run || run.schoolId !== schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'pending') return NextResponse.json({ error: `Run is already ${run.status}` }, { status: 400 })

  const [updated] = await db.update(classPromotionRuns).set({ status: 'dismissed' }).where(eq(classPromotionRuns.id, runId)).returning()
  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/academic-planning/promotions/\[runId\]/dismiss/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/academic-planning/promotions/[runId]/dismiss/route.ts" "app/api/academic-planning/promotions/[runId]/dismiss/route.test.ts"
git commit -m "feat: add class-promotion dismiss endpoint"
```

---

### Task 7: School Settings — academicYearStartMonth field

**Files:**
- Modify: `app/api/admin/schools/route.ts`
- Test: `app/api/admin/schools/route.test.ts`
- Modify: `app/api/admin/schools/[id]/route.ts`
- Test: `app/api/admin/schools/[id]/route.test.ts`
- Modify: `lib/db/queries/adminSchools.ts`
- Test: `lib/db/queries/adminSchools.test.ts`
- Modify: `components/dashboard/management/SchoolsTab.tsx`

**Interfaces:**
- Consumes: `schools.academicYearStartMonth` column from Task 2.
- Produces: `academicYearStartMonth` present on every school object returned by `GET/POST/PATCH /api/admin/schools[/:id]` and `getAdminSchools()`, and editable in the Schools tab UI. Nothing downstream depends on this beyond the cron endpoint (Task 3, already reads the column directly).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/db/queries/adminSchools.test.ts
import { eq } from 'drizzle-orm'
import { db } from '../index'
import { schools, users, adminSchools } from '../schema'
import { getAdminSchools } from './adminSchools'

describe('getAdminSchools', () => {
  it('includes academicYearStartMonth for each school', async () => {
    const [school] = await db.insert(schools).values({ academicYearStartMonth: 6 }).returning()
    const [user] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}@test.com`, password: 'x', role: 'management',
    }).returning()
    await db.insert(adminSchools).values({ userId: user.id, schoolId: school.id, role: 'owner' })

    try {
      const result = await getAdminSchools(user.id)
      expect(result).toHaveLength(1)
      expect(result[0].academicYearStartMonth).toBe(6)
    } finally {
      await db.delete(adminSchools).where(eq(adminSchools.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
```

```typescript
// app/api/admin/schools/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/admin/schools', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/admin/schools — academicYearStartMonth', () => {
  let managerId: string

  beforeEach(async () => {
    const [manager] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}-${Math.random()}@test.com`, password: 'x', role: 'management',
    }).returning()
    managerId = manager.id
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: managerId, role: 'management', email: manager.email } })
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await db.delete(users).where(eq(users.id, managerId))
  })

  it('defaults academicYearStartMonth to 4 when not provided', async () => {
    const res = await POST(req({ name: 'No Month School' }))
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(4)
    await db.delete(schools).where(eq(schools.id, body.id))
  })

  it('persists a valid academicYearStartMonth', async () => {
    const res = await POST(req({ name: 'June Start School', academicYearStartMonth: 6 }))
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(6)
    await db.delete(schools).where(eq(schools.id, body.id))
  })

  it('rejects an out-of-range academicYearStartMonth', async () => {
    const res = await POST(req({ name: 'Bad Month School', academicYearStartMonth: 13 }))
    expect(res.status).toBe(400)
  })
})
```

```typescript
// app/api/admin/schools/[id]/route.test.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, users, adminSchools } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { PATCH } from './route'

function req(body: any) {
  return new Request('http://localhost/api/admin/schools/x', { method: 'PATCH', body: JSON.stringify(body) })
}

describe('PATCH /api/admin/schools/[id] — academicYearStartMonth', () => {
  let managerId: string
  let schoolId: string

  beforeEach(async () => {
    const [manager] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}-${Math.random()}@test.com`, password: 'x', role: 'management',
    }).returning()
    managerId = manager.id
    const [school] = await db.insert(schools).values({ academicYearStartMonth: 4 }).returning()
    schoolId = school.id
    await db.insert(adminSchools).values({ userId: managerId, schoolId, role: 'owner' })
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: managerId, role: 'management' } })
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await db.delete(schools).where(eq(schools.id, schoolId))
    await db.delete(users).where(eq(users.id, managerId))
  })

  it('updates academicYearStartMonth', async () => {
    const res = await PATCH(req({ academicYearStartMonth: 7 }), { params: Promise.resolve({ id: schoolId }) })
    const body = await res.json()
    expect(body.academicYearStartMonth).toBe(7)
  })

  it('rejects an out-of-range academicYearStartMonth', async () => {
    const res = await PATCH(req({ academicYearStartMonth: 0 }), { params: Promise.resolve({ id: schoolId }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest lib/db/queries/adminSchools.test.ts app/api/admin/schools/route.test.ts "app/api/admin/schools/\[id\]/route.test.ts"`
Expected: FAIL — `academicYearStartMonth` is `undefined` in the `getAdminSchools`/POST assertions, and the out-of-range PATCH/POST cases return 200 instead of 400.

- [ ] **Step 3: Write the implementation**

Modify `lib/db/queries/adminSchools.ts` — add `academicYearStartMonth: schools.academicYearStartMonth,` to the `select({...})` object in `getAdminSchools` (right after `joinCode: schools.joinCode,`):

```typescript
      joinCode: schools.joinCode,
      academicYearStartMonth: schools.academicYearStartMonth,
      isActive: schools.isActive,
```

Modify `app/api/admin/schools/route.ts` — in `POST`, add `academicYearStartMonth` to the destructure and validate it, then include it in the insert:

```typescript
  const { name, board, classes, programs, mouStartDate, mouEndDate, contactPerson, phone, email, address, gstNo, academicYearStartMonth } = body
  if (!name?.trim()) return NextResponse.json({ error: 'School name is required' }, { status: 400 })
  if (!isValidGstPrefix(gstNo)) return NextResponse.json({ error: GST_FORMAT_ERROR }, { status: 400 })
  if (!isValidPhone(phone)) return NextResponse.json({ error: PHONE_FORMAT_ERROR }, { status: 400 })
  if (academicYearStartMonth !== undefined && (!Number.isInteger(academicYearStartMonth) || academicYearStartMonth < 1 || academicYearStartMonth > 12)) {
    return NextResponse.json({ error: 'Academic year start month must be an integer from 1 to 12' }, { status: 400 })
  }
```

and in the `db.insert(schools).values({...})` call, add:

```typescript
    gstNo: gstNo || '',
    academicYearStartMonth: academicYearStartMonth ?? 4,
    isActive: true,
```

Modify `app/api/admin/schools/[id]/route.ts` — in `PATCH`, add `academicYearStartMonth` to the destructure, validate, and add to `updates`:

```typescript
  const { name, board, classes, programs, mouStartDate, mouEndDate, isActive, contactPerson, phone, email, address, gstNo, academicYearStartMonth } = body
  if (gstNo !== undefined && !isValidGstPrefix(gstNo)) return NextResponse.json({ error: GST_FORMAT_ERROR }, { status: 400 })
  if (phone !== undefined && !isValidPhone(phone)) return NextResponse.json({ error: PHONE_FORMAT_ERROR }, { status: 400 })
  if (academicYearStartMonth !== undefined && (!Number.isInteger(academicYearStartMonth) || academicYearStartMonth < 1 || academicYearStartMonth > 12)) {
    return NextResponse.json({ error: 'Academic year start month must be an integer from 1 to 12' }, { status: 400 })
  }
  const updates: Record<string, any> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (board !== undefined) updates.board = board
  if (classes !== undefined) updates.classes = classes
  if (programs !== undefined) updates.programs = programs
  if (mouStartDate !== undefined) updates.mouStartDate = mouStartDate
  if (mouEndDate !== undefined) updates.mouEndDate = mouEndDate
  if (isActive !== undefined) updates.isActive = isActive
  if (contactPerson !== undefined) updates.contactPerson = contactPerson
  if (phone !== undefined) updates.phone = phone
  if (email !== undefined) updates.email = email
  if (address !== undefined) updates.address = address
  if (gstNo !== undefined) updates.gstNo = gstNo
  if (academicYearStartMonth !== undefined) updates.academicYearStartMonth = academicYearStartMonth
```

Modify `components/dashboard/management/SchoolsTab.tsx`:

Add a month-name constant right after the `EMPTY_FORM` block (after line 31):

```typescript
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
```

Update the `SchoolEntry` type (line 13-17) to include the new field:

```typescript
type SchoolEntry = {
  id: string; name: string; board: string; classes: string; programs: string
  mouStartDate: string | null; mouEndDate: string | null; joinCode: string | null; isActive: boolean; role: 'owner' | 'member'
  contactPerson?: string; phone?: string; email?: string; address?: string; gstNo?: string
  academicYearStartMonth: number
}
```

Update `EMPTY_FORM` (line 19-31) to include the new field:

```typescript
const EMPTY_FORM = {
  name: '',
  board: 'CBSE Affiliated',
  classes: '6, 7, 8, 9, 10, 11, 12',
  programs: 'JEE, NEET, Foundational',
  mouStartDate: '',
  mouEndDate: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  gstNo: '',
  academicYearStartMonth: 4,
}
```

In the Create School Modal, add a field right after the "Board Affiliation" block (after line 212):

```tsx
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Academic Year Start Month</label>
                  <select value={createForm.academicYearStartMonth} onChange={e => setCreateForm(f => ({ ...f, academicYearStartMonth: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                    {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                  </select>
                </div>
```

In the Edit School Modal, add the matching field right after its "Board Affiliation" block (after line 327):

```tsx
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Academic Year Start Month</label>
                  <select value={editForm.academicYearStartMonth} onChange={e => setEditForm(f => ({ ...f, academicYearStartMonth: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                    {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
                  </select>
                </div>
```

In the Edit button's `onClick` handler (the `setEditForm({...})` call, lines 474-486), add the new field:

```typescript
                        setEditForm({
                          name: school.name,
                          board: school.board,
                          classes: school.classes,
                          programs: school.programs,
                          mouStartDate: school.mouStartDate || '',
                          mouEndDate: school.mouEndDate || '',
                          contactPerson: school.contactPerson || '',
                          phone: school.phone || '',
                          email: school.email || '',
                          address: school.address || '',
                          gstNo: school.gstNo || '',
                          academicYearStartMonth: school.academicYearStartMonth ?? 4,
                        })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/db/queries/adminSchools.test.ts app/api/admin/schools/route.test.ts "app/api/admin/schools/\[id\]/route.test.ts"`
Expected: PASS (6 tests)

Run: `npx tsc --noEmit -p .`
Expected: no errors (verifies the `SchoolsTab.tsx` UI changes type-check; there is no Jest test for this file, matching the codebase's existing no-component-tests convention).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/adminSchools.ts lib/db/queries/adminSchools.test.ts app/api/admin/schools/route.ts app/api/admin/schools/route.test.ts "app/api/admin/schools/[id]/route.ts" "app/api/admin/schools/[id]/route.test.ts" components/dashboard/management/SchoolsTab.tsx
git commit -m "feat: make academic year start month editable per school"
```

---

### Task 8: Promotion tab UI and role-gated wiring

**Files:**
- Create: `components/dashboard/management/PromotionTab.tsx`
- Modify: `components/dashboard/management/AcademicPlanningView.tsx`

**Interfaces:**
- Consumes: `GET /api/academic-planning/promotions` (Task 4), `POST .../[runId]/confirm` (Task 5), `POST .../[runId]/dismiss` (Task 6).
- Produces: a "Promotion" tab visible only to `management`-role users in `AcademicPlanningView.tsx`. Nothing downstream depends on this. No Jest test — this codebase has zero `.test.tsx` files anywhere under `components/`, so verification here is `npx tsc --noEmit -p .` plus a manual dev-server check (see Step 4).

- [ ] **Step 1: Write `PromotionTab.tsx`**

```tsx
// components/dashboard/management/PromotionTab.tsx
'use client'
import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface PromotionRun {
  id: string
  academicYear: string
  boundaryDate: string
  status: 'pending' | 'confirmed' | 'dismissed'
  previewCounts: Record<string, Record<string, number>>
  excludedNewAdmissionCount: number
  excludedTerminalCount: number
  confirmedAt: string | null
  confirmedByName: string | null
  promotedCount: number
  createdAt: string
}

export default function PromotionTab() {
  const [pending, setPending] = useState<PromotionRun | null>(null)
  const [history, setHistory] = useState<PromotionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/academic-planning/promotions')
      const data = await res.json()
      setPending(data.pending)
      setHistory(data.history || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function confirmPromotion() {
    if (!pending) return
    if (!window.confirm(`Promote all eligible students for ${pending.academicYear}? This cannot be undone.`)) return
    setActing(true)
    try {
      await fetch(`/api/academic-planning/promotions/${pending.id}/confirm`, { method: 'POST' })
      await load()
    } finally {
      setActing(false)
    }
  }

  async function dismissPromotion() {
    if (!pending) return
    if (!window.confirm(`Dismiss the ${pending.academicYear} promotion cycle? No students will be promoted.`)) return
    setActing(true)
    try {
      await fetch(`/api/academic-planning/promotions/${pending.id}/dismiss`, { method: 'POST' })
      await load()
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-slate-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      {pending ? (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-1">Class Promotion Ready: {pending.academicYear}</h3>
          <p className="text-sm text-slate-500 mb-4">Boundary date {pending.boundaryDate}. Review before confirming.</p>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2">From Class</th>
                <th className="py-2">To Class</th>
                <th className="py-2">Students</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pending.previewCounts).map(([fromClass, toMap]) =>
                Object.entries(toMap).map(([toClass, count]) => (
                  <tr key={`${fromClass}-${toClass}`} className="border-b border-slate-50">
                    <td className="py-2">{fromClass}</td>
                    <td className="py-2">{toClass}</td>
                    <td className="py-2 font-semibold">{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p className="text-xs text-slate-500 mb-1">{pending.excludedNewAdmissionCount} new admissions held to next year.</p>
          <p className="text-xs text-slate-500 mb-4">{pending.excludedTerminalCount} Class 12 students excluded — handle manually.</p>

          <div className="flex gap-3">
            <button onClick={confirmPromotion} disabled={acting} className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm Promotion
            </button>
            <button onClick={dismissPromotion} disabled={acting} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold disabled:opacity-50">
              <XCircle className="w-4 h-4" /> Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-sm text-slate-500">
          No promotion cycle is currently pending review.
        </div>
      )}

      <div>
        <h3 className="font-bold text-slate-900 mb-3">History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No past promotion cycles yet.</p>
        ) : (
          <table className="w-full text-sm bg-white rounded-xl border border-slate-200 overflow-hidden">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 px-4">Academic Year</th>
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Promoted</th>
                <th className="py-2 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((run) => (
                <tr key={run.id} className="border-b border-slate-50">
                  <td className="py-2 px-4">{run.academicYear}</td>
                  <td className="py-2 px-4">{new Date(run.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-4">{run.promotedCount}</td>
                  <td className="py-2 px-4">
                    {run.status === 'confirmed' ? `Confirmed by ${run.confirmedByName ?? 'Unknown'}` : 'Dismissed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `AcademicPlanningView.tsx`, role-gated**

Add imports (after the existing imports at the top of the file, lines 1-9):

```typescript
'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Plus, MoreVertical, X, Loader2, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import SchoolsTab from './SchoolsTab'
import BatchesTab from './BatchesTab'
import FacultyTab from './FacultyTab'
import SyllabusKanbanBoard from '../SyllabusKanbanBoard'
import PromotionTab from './PromotionTab'
import { MultiSelectTargetExam } from './SchoolFormHelpers'
```

Inside `export default function AcademicPlanningView()`, add the session/role read right after the existing `searchParams`/`activeTab` state (after line 106):

```typescript
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'Schools')
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
```

Replace the static tabs array (line 240) with a role-conditional one. First, add the computed list right above the "Tabs" render block (right before the `{/* Tabs */}` comment on line 237):

```typescript
      {/* Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <div className="flex gap-8">
          {(role === 'management'
            ? ['Schools', 'Programs', 'Batches', 'Syllabus Tracker', 'Faculty', 'Promotion']
            : ['Schools', 'Programs', 'Batches', 'Syllabus Tracker', 'Faculty']
          ).map((tab) => (
```

(this replaces the original `{['Schools', 'Programs', 'Batches', 'Syllabus Tracker', 'Faculty'].map((tab) => (` line — everything else in that block, down through the closing `))}` and `</div></div>`, stays unchanged).

Finally, add the render block for the new tab right after the existing `{activeTab === 'Faculty' && <FacultyTab />}` line (line 358):

```typescript
      {activeTab === 'Faculty' && <FacultyTab />}

      {activeTab === 'Promotion' && role === 'management' && <PromotionTab />}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then as a `management`-role user:
1. Navigate to Academic Planning — confirm a "Promotion" tab now appears alongside the existing tabs.
2. Click it — with no pending run yet, confirm it shows "No promotion cycle is currently pending review." and an empty history state.
3. As a `teacher`-role user, navigate to the same page and confirm the "Promotion" tab does **not** appear.
4. Manually insert a `pending` `class_promotion_runs` row for your dev school (e.g. via `npm run db:studio`), reload the tab, and confirm the banner, preview-counts table, and Confirm/Dismiss buttons render, and that clicking Confirm/Dismiss updates the row and refreshes the view.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/management/PromotionTab.tsx components/dashboard/management/AcademicPlanningView.tsx
git commit -m "feat: add management-only Promotion tab with review banner and history"
```

---

## Self-Review

**Spec coverage:**
- `schools.academicYearStartMonth`, editable in Schools tab — Task 2 (schema/migration), Task 7 (API + UI). ✓
- `class_promotion_runs` / `class_promotion_log` tables, unique `(schoolId, academicYear)` index — Task 2. ✓
- Daily Vercel Cron detection endpoint, `CRON_SECRET` bearer auth, idempotent per-school run creation, notification fan-out — Task 3. ✓
- Eligibility rule (active, class 9/10/11, admission-date boundary, null-date handling) — Task 1 (logic), Task 2 (DB query), tested at the exact-boundary/one-day-before/one-day-after cases per the spec's Testing section — Task 1's test. ✓
- Management-only "Promotion" tab with review banner (preview counts, excluded counts, Confirm/Dismiss) + history — Task 8 (UI), Task 4 (list endpoint backing it). ✓
- Confirm: re-validates eligibility fresh, bumps class, clears batch, completes matching active enrollment, writes log row, updates run to confirmed — Task 5, with the transaction requirement explicitly and deliberately implemented as a sequential loop (documented in Global Constraints) since `neon-http` cannot do real transactions. ✓
- Dismiss: sets `status = 'dismissed'`, touches no student data — Task 6. ✓
- Testing section's four bullets (eligibility boundary, idempotency, confirm transaction incl. Class 12/Repeater untouched, re-validation-at-confirm-time) — Task 1, Task 3, Task 5. ✓
- Non-goals (no Class 12 auto-handling, no batch reassignment, no non-9–12 chains, no per-student anniversary) — none of the tasks introduce any of these; `NEXT_CLASS` in Task 1 is exactly `{'9':'10','10':'11','11':'12'}` and batch is always cleared to `''`, never reassigned. ✓

**Placeholder scan:** no `TBD`/`TODO`/"add appropriate ..." phrasing anywhere above; every step has complete, concrete code.

**Type/signature consistency check:**
- `PromotionCandidate` (Task 1) → `EligibleStudent extends PromotionCandidate` (Task 2) → consumed identically in Task 3's `getEligibleStudents(...)` call and Task 5's `getEligibleStudents(...)` call. ✓
- `NEXT_CLASS` used identically in Task 1's `buildPreviewCounts`, Task 3's cron endpoint (via `buildPreviewCounts`), and Task 5's confirm endpoint. ✓
- `computeBoundaryDate` / `subtractOneYear` / `computeAcademicYearLabel` signatures match between Task 1's definition and Task 3/Task 5's call sites. ✓
- `classPromotionRuns` column names (`previewCounts`, `excludedNewAdmissionCount`, `excludedTerminalCount`, `confirmedAt`, `confirmedBy`) match across Task 2's schema, Task 3's insert, Task 4's select, Task 5's read/update, and Task 8's `PromotionRun` interface. ✓
- `classPromotionLog` column names (`runId`, `studentId`, `fromClass`, `toClass`, `previousBatch`) match between Task 2's schema and Task 5's insert/Task 4's count query. ✓
- `PromotionRun`/`EligibleStudent`/`ClassPromotionRun` etc. are never renamed between tasks. ✓
