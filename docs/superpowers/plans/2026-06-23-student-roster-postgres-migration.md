# Student Roster Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `Student` roster off MongoDB/Mongoose onto the existing Neon Postgres + Drizzle stack, and update every route that reads/writes student data (including the Attendance, Fees, and Test-results routes, which embed `studentId` as a cross-reference) so the app no longer touches the `Student` Mongoose model at all.

**Architecture:** Add a `students` table to the existing `lib/db/schema.ts` (alongside `users`/`email_verifications`/`schools`), add a typed query module `lib/db/queries/students.ts`, then migrate `/api/students` and `/api/students/bulk` to it directly. `Attendance`, `PaymentRecord`, and `TestResult` stay on Mongoose (out of scope for this phase) but their `studentId` field changes from a Mongoose `ObjectId` ref to a plain `String`, since it will now hold a Postgres UUID. Routes that look up `Student` data while building Attendance/Fees/Test-results responses (`/api/attendance`, `/api/attendance/overview`, `/api/fees/payments`, `/api/fees/stats`, `/api/tests/results`) are updated to call the new Postgres query functions instead of the Mongoose `Student` model, while everything else in those routes (the Mongo reads/writes against `Attendance`/`PaymentRecord`/`Test`/`TestResult`/`FeeType`) is untouched.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (`drizzle-orm/neon-http`), Neon Postgres, Mongoose (for the models staying on Mongo this phase), Jest (`testEnvironment: 'node'`, `maxWorkers: 1`, real live Postgres + Mongo).

## Global Constraints

- Every API response shape, status code, and error message must stay byte-identical to what's documented in each task's "before" code — this is a data-layer swap, not a behavior change.
- The wire contract for student records must keep the `_id` field name (not `id`), because six frontend components (`StudentRoster.tsx`, `FeeManagementView.tsx`, `AttendanceMarkingView.tsx`, `AcademicRecordsView.tsx`, `TeacherCounselingLogView.tsx`, `TeacherTestsView.tsx`) read `student._id`/`st._id` directly and are out of scope for this plan.
- `studentId` values change format from a 24-character Mongo `ObjectId` hex string to a 36-character Postgres UUID string going forward. Nothing in scope treats this value as anything but an opaque string (confirmed via grep), so this is safe, but flag it explicitly in Task 10's verification pass.
- New Postgres code follows the conventions already established in `lib/db/schema.ts`, `lib/db/queries/users.ts`, and `lib/db/queries/school.ts` — same import style, same `db.select()/.insert()/.update()/.delete()` patterns, same `eq`/`and`/`inArray` usage from `drizzle-orm`.
- Tests that exercise pure-Postgres code (the `students` query module, `/api/students`, `/api/students/bulk`) hit the real live Neon database, no mocking — same as `lib/db/queries/users.test.ts` and `lib/db/queries/school.test.ts`.
- Tests for routes that mix Mongo and Postgres (`/api/attendance`, `/api/attendance/overview`, `/api/fees/payments`, `/api/fees/stats`, `/api/tests/results`) mock the Mongoose models and `connectDB` (since the Mongo side is untouched and out of scope) but hit real Postgres for the student-related assertions (since that's what's actually being changed).
- Run `npm test` and `npm run build` after every task; both must stay clean.
- Commit after every task.

---

### Task 1: Add `students` table to the Drizzle schema

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/schema.test.ts`
- Create: `lib/db/migrations/0001_*.sql` (name chosen by `drizzle-kit generate`)

**Interfaces:**
- Produces: `students` table export, `Student` type (`typeof students.$inferSelect`), `NewStudent` type (`typeof students.$inferInsert`) from `lib/db/schema.ts`. Columns: `id` (uuid pk), `name` (varchar 255, not null), `rollNo` (varchar 255, not null, default `''`), `class` (varchar 255, not null, default `''`), `section` (varchar 255, not null, default `''`), `parentContact` (varchar 255, nullable), `isActive` (boolean, not null, default `true`), `createdAt`/`updatedAt` (timestamp with timezone, default now, not null). Partial unique index on `(rollNo, class, section)` where all three are non-empty, mirroring the original Mongoose `partialFilterExpression`.

- [ ] **Step 1: Add the `students` table to the schema**

In `lib/db/schema.ts`, change the import line and append the new table at the end of the file:

```ts
import { pgTable, uuid, text, varchar, timestamp, pgEnum, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
```

Append at the end of the file:

```ts
export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    rollNo: varchar('roll_no', { length: 255 }).notNull().default(''),
    class: varchar('class', { length: 255 }).notNull().default(''),
    section: varchar('section', { length: 255 }).notNull().default(''),
    parentContact: varchar('parent_contact', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rollClassSectionUnique: uniqueIndex('students_roll_no_class_section_unique')
      .on(table.rollNo, table.class, table.section)
      .where(sql`${table.rollNo} <> '' AND ${table.class} <> '' AND ${table.section} <> ''`),
  })
)

export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new file appears at `lib/db/migrations/0001_<name>.sql` containing a `CREATE TABLE "students"` statement and a `CREATE UNIQUE INDEX` statement for `students_roll_no_class_section_unique` with a `WHERE` clause.

- [ ] **Step 3: Apply the migration**

Run: `npm run db:migrate`
Expected: command exits 0, reports the new migration applied.

- [ ] **Step 4: Extend the schema smoke test**

In `lib/db/schema.test.ts`, replace the whole file:

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

- [ ] **Step 5: Run the test**

Run: `npm test -- schema.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/schema.test.ts lib/db/migrations
git commit -m "feat: add drizzle schema for students table"
```

---

### Task 2: Add typed query functions for students

**Files:**
- Create: `lib/db/queries/students.ts`
- Create: `lib/db/queries/students.test.ts`

**Interfaces:**
- Consumes: `students`, `type Student`, `type NewStudent` from `../schema` (Task 1).
- Produces (all consumed by Tasks 3–9):
  - `export interface ListStudentsFilters { class?: string; section?: string; activeOnly?: boolean }`
  - `listStudents(filters?: ListStudentsFilters): Promise<Student[]>`
  - `findStudentsByClasses(classes: string[], activeOnly?: boolean): Promise<Student[]>`
  - `countStudentsByClasses(classes: string[]): Promise<number>`
  - `deleteStudentsByClasses(classes: string[]): Promise<void>`
  - `getStudentById(id: string): Promise<Student | null>`
  - `createStudent(data: NewStudent): Promise<Student>`
  - `bulkInsertStudents(data: NewStudent[]): Promise<Student[]>`
  - `upsertStudentByRollClassSection(data: NewStudent): Promise<Student>`
  - `updateStudent(id: string, data: Partial<NewStudent>): Promise<Student | null>`
  - `deactivateStudent(id: string): Promise<Student | null>`
  - `deleteStudent(id: string): Promise<void>`
  - `deleteAllStudents(): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `lib/db/queries/students.test.ts`:

```ts
import { db } from '../index'
import { students } from '../schema'
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
} from './students'

describe('students queries', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('createStudent inserts a row with defaults applied', async () => {
    const student = await createStudent({ name: 'Test Student' })
    expect(student.name).toBe('Test Student')
    expect(student.rollNo).toBe('')
    expect(student.isActive).toBe(true)
  })

  it('getStudentById returns the created row', async () => {
    const created = await createStudent({ name: 'Lookup Me' })
    const found = await getStudentById(created.id)
    expect(found?.name).toBe('Lookup Me')
  })

  it('getStudentById returns null for an unknown id', async () => {
    const found = await getStudentById('00000000-0000-0000-0000-000000000000')
    expect(found).toBeNull()
  })

  it('listStudents defaults to active-only and sorts by class/section/rollNo', async () => {
    await createStudent({ name: 'Inactive One', isActive: false })
    await createStudent({ name: 'Active One', class: '11 - A', section: 'A', rollNo: '002' })
    await createStudent({ name: 'Active Two', class: '11 - A', section: 'A', rollNo: '001' })

    const result = await listStudents()
    expect(result.map((s) => s.name)).toEqual(['Active Two', 'Active One'])
  })

  it('listStudents can filter by class and section', async () => {
    await createStudent({ name: 'In Class', class: '10 - B', section: 'B' })
    await createStudent({ name: 'Other Class', class: '11 - A', section: 'A' })

    const result = await listStudents({ class: '10 - B', section: 'B' })
    expect(result.map((s) => s.name)).toEqual(['In Class'])
  })

  it('findStudentsByClasses returns active students in the given classes, sorted by rollNo/name', async () => {
    await createStudent({ name: 'Zed', class: '11 - A', rollNo: '001', isActive: true })
    await createStudent({ name: 'Amy', class: '11 - A', rollNo: '002', isActive: true })
    await createStudent({ name: 'Skipped', class: '10 - A', rollNo: '003', isActive: true })
    await createStudent({ name: 'Inactive', class: '11 - A', rollNo: '004', isActive: false })

    const result = await findStudentsByClasses(['11 - A'])
    expect(result.map((s) => s.name)).toEqual(['Zed', 'Amy'])
  })

  it('countStudentsByClasses counts regardless of active status', async () => {
    await createStudent({ name: 'A', class: '11 - B', isActive: true })
    await createStudent({ name: 'B', class: '11 - B', isActive: false })

    const count = await countStudentsByClasses(['11 - B'])
    expect(count).toBe(2)
  })

  it('deleteStudentsByClasses removes only matching rows', async () => {
    await createStudent({ name: 'Keep', class: '10 - A' })
    await createStudent({ name: 'Remove', class: '10 - B' })

    await deleteStudentsByClasses(['10 - B'])

    const remaining = await listStudents({ activeOnly: false })
    expect(remaining.map((s) => s.name)).toEqual(['Keep'])
  })

  it('bulkInsertStudents inserts every row and returns them', async () => {
    const result = await bulkInsertStudents([
      { name: 'Bulk One' },
      { name: 'Bulk Two' },
    ])
    expect(result).toHaveLength(2)
  })

  it('bulkInsertStudents returns an empty array for an empty input', async () => {
    const result = await bulkInsertStudents([])
    expect(result).toEqual([])
  })

  it('upsertStudentByRollClassSection inserts when no match exists', async () => {
    const result = await upsertStudentByRollClassSection({
      name: 'New Upsert',
      rollNo: '11A-001',
      class: '11 - A',
      section: 'A',
    })
    expect(result.name).toBe('New Upsert')
  })

  it('upsertStudentByRollClassSection updates the existing row on a second call', async () => {
    await upsertStudentByRollClassSection({ name: 'First Name', rollNo: '11A-002', class: '11 - A', section: 'A' })
    const updated = await upsertStudentByRollClassSection({ name: 'Updated Name', rollNo: '11A-002', class: '11 - A', section: 'A' })

    const all = await listStudents({ activeOnly: false, class: '11 - A', section: 'A' })
    expect(all).toHaveLength(1)
    expect(updated.name).toBe('Updated Name')
  })

  it('updateStudent updates the given fields', async () => {
    const created = await createStudent({ name: 'Before' })
    const updated = await updateStudent(created.id, { name: 'After' })
    expect(updated?.name).toBe('After')
  })

  it('updateStudent returns null for an unknown id', async () => {
    const result = await updateStudent('00000000-0000-0000-0000-000000000000', { name: 'X' })
    expect(result).toBeNull()
  })

  it('deactivateStudent sets isActive to false', async () => {
    const created = await createStudent({ name: 'To Deactivate' })
    const result = await deactivateStudent(created.id)
    expect(result?.isActive).toBe(false)
  })

  it('deleteStudent removes the row', async () => {
    const created = await createStudent({ name: 'To Delete' })
    await deleteStudent(created.id)
    const found = await getStudentById(created.id)
    expect(found).toBeNull()
  })

  it('deleteAllStudents empties the table', async () => {
    await createStudent({ name: 'One' })
    await createStudent({ name: 'Two' })
    await deleteAllStudents()
    const result = await listStudents({ activeOnly: false })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- students.test.ts`
Expected: FAIL — `Cannot find module './students'`.

- [ ] **Step 3: Write the implementation**

Create `lib/db/queries/students.ts`:

```ts
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, type Student, type NewStudent } from '../schema'

export interface ListStudentsFilters {
  class?: string
  section?: string
  activeOnly?: boolean
}

export async function listStudents(filters: ListStudentsFilters = {}): Promise<Student[]> {
  const conditions = []
  if (filters.activeOnly !== false) conditions.push(eq(students.isActive, true))
  if (filters.class) conditions.push(eq(students.class, filters.class))
  if (filters.section) conditions.push(eq(students.section, filters.section))

  if (conditions.length === 0) {
    return db.select().from(students).orderBy(students.class, students.section, students.rollNo)
  }
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.class, students.section, students.rollNo)
}

export async function findStudentsByClasses(classes: string[], activeOnly = true): Promise<Student[]> {
  const conditions = [inArray(students.class, classes)]
  if (activeOnly) conditions.push(eq(students.isActive, true))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function countStudentsByClasses(classes: string[]): Promise<number> {
  const rows = await db.select().from(students).where(inArray(students.class, classes))
  return rows.length
}

export async function deleteStudentsByClasses(classes: string[]): Promise<void> {
  await db.delete(students).where(inArray(students.class, classes))
}

export async function getStudentById(id: string): Promise<Student | null> {
  const rows = await db.select().from(students).where(eq(students.id, id))
  return rows[0] ?? null
}

export async function createStudent(data: NewStudent): Promise<Student> {
  const rows = await db.insert(students).values(data).returning()
  return rows[0]
}

export async function bulkInsertStudents(data: NewStudent[]): Promise<Student[]> {
  if (data.length === 0) return []
  return db.insert(students).values(data).returning()
}

export async function upsertStudentByRollClassSection(data: NewStudent): Promise<Student> {
  const existing = await db
    .select()
    .from(students)
    .where(
      and(
        eq(students.rollNo, data.rollNo ?? ''),
        eq(students.class, data.class ?? ''),
        eq(students.section, data.section ?? '')
      )
    )
  if (existing[0]) {
    const updated = await db
      .update(students)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id))
      .returning()
    return updated[0]
  }
  return createStudent(data)
}

export async function updateStudent(id: string, data: Partial<NewStudent>): Promise<Student | null> {
  const rows = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deactivateStudent(id: string): Promise<Student | null> {
  return updateStudent(id, { isActive: false })
}

export async function deleteStudent(id: string): Promise<void> {
  await db.delete(students).where(eq(students.id, id))
}

export async function deleteAllStudents(): Promise<void> {
  await db.delete(students)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- students.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/students.ts lib/db/queries/students.test.ts
git commit -m "feat: add typed query functions for students table"
```

---

### Task 3: Migrate `/api/students` route to Postgres

**Files:**
- Modify: `app/api/students/route.ts`
- Create: `app/api/students/route.test.ts`

**Interfaces:**
- Consumes: `listStudents`, `createStudent`, `updateStudent`, `deactivateStudent`, `deleteStudent` from `@/lib/db/queries/students` (Task 2); `type Student` from `@/lib/db/schema` (Task 1).
- Produces: every student object in every JSON response has `_id` (not `id`) as its identifier field — required by the Global Constraints section.

- [ ] **Step 1: Write the failing test**

Create `app/api/students/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('GET /api/students', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/students'))
    expect(res.status).toBe(401)
  })

  it('returns active students shaped with _id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    await db.insert(students).values({ name: 'Active Kid', class: '11 - A', section: 'A' })
    await db.insert(students).values({ name: 'Inactive Kid', isActive: false })

    const res = await GET(req('http://localhost/api/students'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Active Kid')
    expect(typeof body[0]._id).toBe('string')
    expect(body[0].id).toBeUndefined()
  })

  it('filters by class and section query params', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    await db.insert(students).values({ name: 'Match', class: '10 - B', section: 'B' })
    await db.insert(students).values({ name: 'No Match', class: '11 - A', section: 'A' })

    const res = await GET(req('http://localhost/api/students?class=10 - B&section=B'))
    const body = await res.json()
    expect(body.map((s: any) => s.name)).toEqual(['Match'])
  })
})

describe('POST /api/students', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('rejects when the role is not management or teacher', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify({ name: 'X' }) }))
    expect(res.status).toBe(403)
  })

  it('rejects when name is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify({ name: '   ' }) }))
    expect(res.status).toBe(400)
  })

  it('creates a student and returns it shaped with _id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(
      req('http://localhost/api/students', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Student', rollNo: '001', class: '11 - A', section: 'A' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.name).toBe('New Student')
    expect(typeof body._id).toBe('string')
  })

  it('returns 409 on a duplicate rollNo+class+section', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const payload = { name: 'Dup', rollNo: '11A-001', class: '11 - A', section: 'A' }
    await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify(payload) }))
    const res = await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify(payload) }))
    expect(res.status).toBe(409)
  })
})

describe('PATCH /api/students', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await PATCH(req('http://localhost/api/students?id=x', { method: 'PATCH', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('updates a student by id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'Before' }).returning()

    const res = await PATCH(
      req(`http://localhost/api/students?id=${created.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'After' }) })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.name).toBe('After')
    expect(body._id).toBe(created.id)
  })

  it('returns 404 for an unknown id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await PATCH(
      req('http://localhost/api/students?id=00000000-0000-0000-0000-000000000000', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'After' }),
      })
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/students', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('soft-deletes by default', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()

    const res = await DELETE(req(`http://localhost/api/students?id=${created.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)

    const [row] = await db.select().from(students).where(eq(students.id, created.id))
    expect(row.isActive).toBe(false)
  })

  it('permanently deletes when permanent=true', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()

    await DELETE(req(`http://localhost/api/students?id=${created.id}&permanent=true`, { method: 'DELETE' }))

    const rows = await db.select().from(students).where(eq(students.id, created.id))
    expect(rows).toHaveLength(0)
  })
})
```

Add the missing `eq` import at the top of the test file (it's used in the DELETE describe block):

```ts
import { eq } from 'drizzle-orm'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/students/route.test.ts`
Expected: FAIL — current route still imports `@/models/Student` and `connectDB`, response shape has `_id` already (Mongoose), but the test will fail because nothing in `app/api/students/route.ts` writes to the `students` Postgres table, so assertions against `db.select().from(students)` find no rows.

- [ ] **Step 3: Rewrite the route**

Replace `app/api/students/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listStudents,
  createStudent,
  updateStudent,
  deactivateStudent,
  deleteStudent,
  type ListStudentsFilters,
} from '@/lib/db/queries/students'
import type { NewStudent, Student } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

function toApiShape(student: Student) {
  const { id, ...rest } = student
  return { _id: id, ...rest }
}

// GET — fetch students, optionally filtered by class & section
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const classFilter = searchParams.get('class')
    const sectionFilter = searchParams.get('section')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const filters: ListStudentsFilters = { activeOnly }
    if (classFilter) filters.class = classFilter
    if (sectionFilter) filters.section = sectionFilter

    const rows = await listStudents(filters)
    return NextResponse.json(rows.map(toApiShape))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a single student (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can add students' }, { status: 403 })
    }

    const body = await req.json()
    const { name, rollNo, class: cls, section, parentContact } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Student name is required.' }, { status: 400 })
    }

    const student = await createStudent({
      name: name.trim(),
      rollNo: rollNo?.trim() || '',
      class: cls?.trim() || '',
      section: section?.trim() || '',
      parentContact: parentContact?.trim() || '',
    })
    return NextResponse.json(toApiShape(student), { status: 201 })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A student with that roll number already exists in this class and section.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update a student record (management only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can edit students' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    const body = await req.json()
    const { name, rollNo, class: cls, section, parentContact, isActive } = body
    const updateData: Partial<NewStudent> = {}
    if (name !== undefined) updateData.name = name
    if (rollNo !== undefined) updateData.rollNo = rollNo
    if (cls !== undefined) updateData.class = cls
    if (section !== undefined) updateData.section = section
    if (parentContact !== undefined) updateData.parentContact = parentContact
    if (isActive !== undefined) updateData.isActive = isActive

    const student = await updateStudent(id, updateData)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    return NextResponse.json(toApiShape(student))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — soft-delete a student (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove students' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })

    if (permanent) {
      await deleteStudent(id)
    } else {
      await deactivateStudent(id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

Note: the original Mongoose `PATCH` passed the raw request body straight into `findByIdAndUpdate`, relying on Mongoose to silently ignore unknown fields. Drizzle's `.set()` has no such allowance, so this rewrite explicitly whitelists the same five editable fields the frontend ever sends (`name`, `rollNo`, `class`, `section`, `parentContact`) plus `isActive`. This is not a behavior change for any real caller — note it in the task report.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/students/route.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/students/route.ts app/api/students/route.test.ts
git commit -m "feat: migrate students route to postgres"
```

---

### Task 4: Migrate `/api/students/bulk` route to Postgres

**Files:**
- Modify: `app/api/students/bulk/route.ts`
- Create: `app/api/students/bulk/route.test.ts`

**Interfaces:**
- Consumes: `upsertStudentByRollClassSection`, `createStudent`, `deleteAllStudents` from `@/lib/db/queries/students` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `app/api/students/bulk/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { POST, DELETE } from './route'

function req(body: any, method = 'POST') {
  return new Request('http://localhost/api/students/bulk', { method, body: JSON.stringify(body) }) as any
}

describe('POST /api/students/bulk', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('rejects when the role is not staff', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req({ students: [{ name: 'X' }] }))
    expect(res.status).toBe(403)
  })

  it('rejects an empty array', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [] }))
    expect(res.status).toBe(400)
  })

  it('inserts name-only rows as plain creates', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'A' }, { name: 'B' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body).toEqual({ succeeded: 2, failed: 0, total: 2, failedReasons: [] })

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(2)
  })

  it('upserts rows with rollNo+class+section instead of duplicating them', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const row = { name: 'First', rollNo: '001', class: '11 - A', section: 'A' }
    await POST(req({ students: [row] }))
    await POST(req({ students: [{ ...row, name: 'Updated' }] }))

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Updated')
  })

  it('skips rows with no name and reports the total of valid rows', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: '' }, { name: 'Valid' }] }))
    const body = await res.json()
    expect(body.total).toBe(1)
  })
})

describe('DELETE /api/students/bulk', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('rejects when the role is not staff', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await DELETE(req(undefined, 'DELETE'))
    expect(res.status).toBe(403)
  })

  it('deletes every student row', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    await db.insert(students).values({ name: 'One' })
    await db.insert(students).values({ name: 'Two' })

    const res = await DELETE(req(undefined, 'DELETE'))
    expect(res.status).toBe(200)

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: FAIL — route still writes to Mongoose, so Postgres assertions find no rows.

- [ ] **Step 3: Rewrite the route**

Replace `app/api/students/bulk/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { upsertStudentByRollClassSection, createStudent, deleteAllStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    const body = await req.json()
    const { students } = body

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Only name is required; all other fields are optional
    const valid = students.filter((s: any) => s.name?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      valid.map((s: any) => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = s.section?.trim() || ''
        const parentContact = s.parentContact?.trim() || ''

        // If rollNo + class + section all present → upsert (prevents duplicates)
        // Otherwise → plain insert (name-only rows are always added)
        if (rollNo && cls && section) {
          return upsertStudentByRollClassSection({ name, rollNo, class: cls, section, parentContact, isActive: true })
        } else {
          return createStudent({ name, rollNo, class: cls, section, parentContact, isActive: true })
        }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failedResults = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    const failed = failedResults.length
    const failedReasons = failedResults.map((r) => r.reason?.message || r.reason)

    if (failed > 0) {
      console.error('Bulk import failures:', failedReasons)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, failedReasons }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — bulk delete all students (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can clear all rosters' }, { status: 403 })
    }

    await deleteAllStudents()

    return NextResponse.json({ success: true, message: 'All students deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/students/bulk/route.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/students/bulk/route.ts app/api/students/bulk/route.test.ts
git commit -m "feat: migrate students bulk-import route to postgres"
```

---

### Task 5: Update the `Attendance` model's `studentId` field and migrate `/api/attendance`

**Files:**
- Modify: `models/Attendance.ts`
- Modify: `app/api/attendance/route.ts`
- Create: `app/api/attendance/route.test.ts`

**Interfaces:**
- Consumes: `countStudentsByClasses`, `findStudentsByClasses`, `bulkInsertStudents` from `@/lib/db/queries/students` (Task 2).
- Produces: `IAttendanceRecord.studentId` is now `string` (was `mongoose.Types.ObjectId`); the `Attendance` Mongoose schema's `records.studentId` field is now `{ type: String, required: true }` (was `{ type: Schema.Types.ObjectId, ref: 'Student', required: true }`).

- [ ] **Step 1: Change the `studentId` field type on the `Attendance` model**

In `models/Attendance.ts`, change the interface and the schema field:

```ts
import mongoose, { Document, Schema } from 'mongoose'

export interface IAttendanceRecord {
  studentId: string
  studentName: string
  rollNo?: string
  status: 'Present' | 'Absent' | 'Late' | ''
  notes?: string
}

export interface IAttendance extends Document {
  date: string
  batch: string
  subject: string
  classTime: string
  records: IAttendanceRecord[]
  createdAt: Date
  updatedAt: Date
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  rollNo: { type: String, default: '' },
  status: { type: String, enum: ['Present', 'Absent', 'Late', ''], default: '' },
  notes: { type: String, default: '' }
})

const AttendanceSchema = new Schema<IAttendance>(
  {
    date: { type: String, required: true },
    batch: { type: String, required: true },
    subject: { type: String, required: true },
    classTime: { type: String, required: true },
    records: [AttendanceRecordSchema]
  },
  { timestamps: true }
)

// Index to prevent double marking of attendance on same day for same subject and batch
AttendanceSchema.index({ date: 1, batch: 1, subject: 1 }, { unique: true })

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema)
```

- [ ] **Step 2: Write the failing test**

Create `app/api/attendance/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockFindOne = jest.fn()
const mockFindOneAndUpdate = jest.fn()
jest.mock('@/models/Attendance', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => ({ lean: () => mockFindOne(...args) }),
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('GET /api/attendance', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    expect(res.status).toBe(401)
  })

  it('rejects when required query params are missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/attendance'))
    expect(res.status).toBe(400)
  })

  it('returns the existing sheet when one is already marked', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values(
      Array.from({ length: 12 }, (_, i) => ({ name: `Student ${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    const existingSheet = { date: '2026-01-01', batch: '11 - A', subject: 'Physics', records: [] }
    mockFindOne.mockResolvedValue(existingSheet)

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(existingSheet)
  })

  it('builds a default record template from real Postgres students when no sheet exists', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values(
      Array.from({ length: 12 }, (_, i) => ({ name: `Student ${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    mockFindOne.mockResolvedValue(null)

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isNew).toBe(true)
    expect(body.records).toHaveLength(12)
    expect(typeof body.records[0].studentId).toBe('string')
    expect(body.records[0].studentId.length).toBeGreaterThan(20)
  })
})

describe('POST /api/attendance', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects when the role is not teacher or management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('upserts the attendance sheet with the given records', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const saved = { date: '2026-01-01', batch: '11 - A', subject: 'Physics', classTime: '09:00 AM - 10:00 AM', records: [] }
    mockFindOneAndUpdate.mockResolvedValue(saved)

    const res = await POST(
      req('http://localhost/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-01-01',
          batch: '11 - A',
          subject: 'Physics',
          records: [{ studentId: 'some-uuid', studentName: 'A', rollNo: '1', status: 'Present' }],
        }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(saved)
    expect(mockFindOneAndUpdate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- app/api/attendance/route.test.ts`
Expected: FAIL — route still imports `@/models/Student`, so the Postgres-seeded students in the test are never read.

- [ ] **Step 4: Rewrite the route**

Replace `app/api/attendance/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Attendance from '@/models/Attendance'
import { auth } from '@/lib/auth'
import { countStudentsByClasses, findStudentsByClasses, bulkInsertStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// Helper to map UI Batch dropdown values to DB Student Class formats
function resolveClassFromBatch(batch: string): string {
  let cls = batch.trim()
  if (cls.toLowerCase().startsWith('grade ')) {
    cls = cls.substring(6) // remove 'Grade '
  }
  // Convert '11-A' or '10-B' to '11 - A' or '10 - B'
  if (/^\d+-[A-Z]$/.test(cls)) {
    const parts = cls.split('-')
    cls = `${parts[0]} - ${parts[1]}`
  }
  return cls
}

// GET — load marked attendance OR default class list
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const batch = searchParams.get('batch')
    const subject = searchParams.get('subject')

    if (!date || !batch || !subject) {
      return NextResponse.json({ error: 'Missing query parameters: date, batch, subject' }, { status: 400 })
    }

    // Seeding check: Ensure student roster exists for classes 11-A, 11-B, etc.
    const targetClassCount = await countStudentsByClasses(['11 - A', '11 - B', '10 - A', '10 - B', 'Grade 11-A', 'Grade 11-B'])
    if (targetClassCount < 10) {
      const firstNames = ['Karan', 'Isha', 'Rohan', 'Meera', 'Amit', 'Neha', 'Rahul', 'Priya', 'Sanjay', 'Deepa', 'Vijay', 'Anjali', 'Rajesh', 'Sunita', 'Vikram', 'Kavita', 'Arjun', 'Pooja', 'Aditya', 'Ritu']
      const lastNames = ['Sharma', 'Patel', 'Gupta', 'Kumar', 'Verma', 'Singh', 'Joshi', 'Mehta', 'Shah', 'Rao', 'Nair', 'Das', 'Sen', 'Reddy', 'Gowda', 'Mishra', 'Trivedi', 'Pandey', 'Choudhury', 'Gill']

      const newStudentsData = []

      // Explicitly insert Kunal Singhi in 11 - B to match search criteria
      newStudentsData.push({
        name: 'Kunal Singhi',
        rollNo: '11B-001',
        class: '11 - B',
        section: 'B',
        parentContact: '+91 98765 43210',
        isActive: true
      })

      for (let i = 0; i < 50; i++) {
        const fn = firstNames[i % firstNames.length]
        const ln = lastNames[i % lastNames.length]
        const classNum = i % 2 === 0 ? '11' : '10'
        const sec = i % 3 === 0 ? 'A' : 'B'
        const rollNum = `${classNum}${sec}-${String(i + 2).padStart(3, '0')}`

        newStudentsData.push({
          name: `${fn} ${ln}`,
          rollNo: rollNum,
          class: `${classNum} - ${sec}`,
          section: sec,
          parentContact: `+91 98765 ${String(10000 + i)}`,
          isActive: true
        })
      }
      await bulkInsertStudents(newStudentsData)
    }

    // Try finding an existing marked attendance sheet
    const existing = await Attendance.findOne({ date, batch, subject }).lean()

    if (existing) {
      return NextResponse.json(existing)
    }

    // If no sheet exists, load all active students of this batch to mark attendance
    const resolvedClass = resolveClassFromBatch(batch)
    const students = await findStudentsByClasses([resolvedClass, batch], true)

    const defaultRecords = students.map((st) => ({
      studentId: st.id,
      studentName: st.name,
      rollNo: st.rollNo || '',
      status: '', // initially empty/unmarked
      notes: ''
    }))

    // Return template attendance sheet
    return NextResponse.json({
      date,
      batch,
      subject,
      classTime: '09:00 AM - 10:00 AM', // default mock slot
      records: defaultRecords,
      isNew: true
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — save or update attendance sheet
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher' && (session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { date, batch, subject, classTime, records } = body

    if (!date || !batch || !subject || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required body parameters.' }, { status: 400 })
    }

    // Upsert the marked attendance document
    const attendance = await Attendance.findOneAndUpdate(
      { date, batch, subject },
      {
        date,
        batch,
        subject,
        classTime: classTime || '09:00 AM - 10:00 AM',
        records: records.map((r: any) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          rollNo: r.rollNo || '',
          status: r.status || '',
          notes: r.notes || ''
        }))
      },
      { new: true, upsert: true }
    )

    return NextResponse.json(attendance, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app/api/attendance/route.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add models/Attendance.ts app/api/attendance/route.ts app/api/attendance/route.test.ts
git commit -m "feat: migrate attendance route's student lookups to postgres"
```

---

### Task 6: Migrate `/api/attendance/overview` to Postgres

**Files:**
- Modify: `app/api/attendance/overview/route.ts`
- Create: `app/api/attendance/overview/route.test.ts`

**Interfaces:**
- Consumes: `countStudentsByClasses`, `deleteStudentsByClasses`, `bulkInsertStudents`, `findStudentsByClasses` from `@/lib/db/queries/students` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `app/api/attendance/overview/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockCountDocuments = jest.fn()
const mockDeleteMany = jest.fn()
const mockInsertMany = jest.fn()
const mockFind = jest.fn()
jest.mock('@/models/Attendance', () => ({
  __esModule: true,
  default: {
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
    deleteMany: (...args: any[]) => mockDeleteMany(...args),
    insertMany: (...args: any[]) => mockInsertMany(...args),
    find: (...args: any[]) => ({ lean: () => mockFind(...args) }),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/attendance/overview', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance/overview'))
    expect(res.status).toBe(401)
  })

  it('seeds 250 Postgres students when the target classes are not already populated, then computes metrics from Mongo sheets', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockCountDocuments.mockResolvedValue(0) // forces the historical re-seed branch
    mockDeleteMany.mockResolvedValue({})
    mockInsertMany.mockResolvedValue([])
    mockFind.mockResolvedValue([])

    const res = await GET(req('http://localhost/api/attendance/overview?range=30'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overallRate).toBe(92.4) // fallback when there are no sheets at all
    expect(body.heatmap).toHaveLength(30)

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(250)
  })

  it('does not reseed students when the target class count is already 250', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    await db.insert(students).values(
      Array.from({ length: 250 }, (_, i) => ({ name: `S${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    mockCountDocuments.mockResolvedValue(150) // sheet count > 100, skips attendance re-seed too
    mockFind.mockResolvedValue([])

    await GET(req('http://localhost/api/attendance/overview'))

    expect(mockDeleteMany).not.toHaveBeenCalled()
    expect(mockInsertMany).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/attendance/overview/route.test.ts`
Expected: FAIL — route still seeds/queries via `@/models/Student`.

- [ ] **Step 3: Rewrite the route**

Replace `app/api/attendance/overview/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Attendance from '@/models/Attendance'
import { auth } from '@/lib/auth'
import { countStudentsByClasses, deleteStudentsByClasses, bulkInsertStudents, findStudentsByClasses } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// Helper to generate dates for the last N days
function getLastNDaysDates(n: number) {
  const dates = []
  const today = new Date()
  for (let i = n; i >= 1; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// Seeding logic for historical attendance data
async function seedHistoricalAttendance() {
  // Check target student count. If it is not exactly 250, clean seed them.
  const targetStudentsCount = await countStudentsByClasses(['11 - A', '11 - B', '10 - A', '10 - B'])

  if (targetStudentsCount !== 250) {
    // Delete any old students in these target classes
    await deleteStudentsByClasses(['11 - A', '11 - B', '10 - A', '10 - B', 'Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B'])

    const firstNames = ['Karan', 'Isha', 'Rohan', 'Meera', 'Amit', 'Neha', 'Rahul', 'Priya', 'Sanjay', 'Deepa', 'Vijay', 'Anjali', 'Rajesh', 'Sunita', 'Vikram', 'Kavita', 'Arjun', 'Pooja', 'Aditya', 'Ritu']
    const lastNames = ['Sharma', 'Patel', 'Gupta', 'Kumar', 'Verma', 'Singh', 'Joshi', 'Mehta', 'Shah', 'Rao', 'Nair', 'Das', 'Sen', 'Reddy', 'Gowda', 'Mishra', 'Trivedi', 'Pandey', 'Choudhury', 'Gill']

    const seedStudents = []

    // 1. Grade 11-A: 65 students
    for (let i = 1; i <= 65; i++) {
      const fn = firstNames[i % firstNames.length]
      const ln = lastNames[(i + 3) % lastNames.length]
      seedStudents.push({
        name: `${fn} ${ln}`,
        rollNo: `11A-${String(i).padStart(3, '0')}`,
        class: `11 - A`,
        section: `A`,
        parentContact: `+91 98765 ${String(10000 + i)}`,
        isActive: true
      })
    }

    // 2. Grade 10-A: 65 students
    for (let i = 1; i <= 65; i++) {
      const fn = firstNames[(i + 5) % firstNames.length]
      const ln = lastNames[(i + 7) % lastNames.length]
      seedStudents.push({
        name: `${fn} ${ln}`,
        rollNo: `10A-${String(i).padStart(3, '0')}`,
        class: `10 - A`,
        section: `A`,
        parentContact: `+91 98765 ${String(20000 + i)}`,
        isActive: true
      })
    }

    // 3. Grade 11-B: 60 students
    // First is Kunal Singhi
    seedStudents.push({
      name: 'Kunal Singhi',
      rollNo: '11B-001',
      class: '11 - B',
      section: 'B',
      parentContact: '+91 98765 43210',
      isActive: true
    })
    for (let i = 2; i <= 60; i++) {
      const fn = firstNames[(i + 9) % firstNames.length]
      const ln = lastNames[(i + 11) % lastNames.length]
      seedStudents.push({
        name: `${fn} ${ln}`,
        rollNo: `11B-${String(i).padStart(3, '0')}`,
        class: `11 - B`,
        section: `B`,
        parentContact: `+91 98765 ${String(30000 + i)}`,
        isActive: true
      })
    }

    // 4. Grade 10-B: 60 students
    for (let i = 1; i <= 60; i++) {
      const fn = firstNames[(i + 13) % firstNames.length]
      const ln = lastNames[(i + 15) % lastNames.length]
      seedStudents.push({
        name: `${fn} ${ln}`,
        rollNo: `10B-${String(i).padStart(3, '0')}`,
        class: `10 - B`,
        section: `B`,
        parentContact: `+91 98765 ${String(40000 + i)}`,
        isActive: true
      })
    }

    await bulkInsertStudents(seedStudents)
  }

  // Clear and re-seed attendance sheets if sheet count < 100
  const sheetsCount = await Attendance.countDocuments()
  if (sheetsCount > 100) return

  // Delete any old attendance sheets
  await Attendance.deleteMany({})

  const activeStudents = await findStudentsByClasses(['11 - A', '11 - B', '10 - A', '10 - B'], true)

  const dates = getLastNDaysDates(30) // last 30 days
  const batches = ['Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B']
  const subjects = [
    'Physics (PHY-101)',
    'Chemistry (CHE-101)',
    'Mathematics (MAT-101)',
    'English (ENG-101)',
    'Computer Science (CS-101)',
    'Physical Education (PE-101)'
  ]

  const insertData = []

  for (const date of dates) {
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0) continue // Skip Sundays

    for (const batch of batches) {
      const classPart = batch.substring(6, 8) // '11' or '10'
      const secPart = batch.substring(9) // 'A' or 'B'
      const targetClass = `${classPart} - ${secPart}`

      const batchStudents = activeStudents.filter(s => s.class === targetClass)
      if (batchStudents.length === 0) continue

      for (const subject of subjects) {
        // Target rates: P = 0.87625 for normal, and 67%/70%/72% for needy ones
        let targetRate = 0.87625
        if (batch === 'Grade 10-B' && subject === 'Chemistry (CHE-101)') {
          targetRate = 0.67
        } else if (batch === 'Grade 10-B' && subject === 'Mathematics (MAT-101)') {
          targetRate = 0.70
        } else if (batch === 'Grade 11-B' && subject === 'Mathematics (MAT-101)') {
          targetRate = 0.72
        }

        const perfectCountInBatch = batch === 'Grade 11-A' || batch === 'Grade 10-A'
          ? batchStudents.length
          : (batch === 'Grade 11-B' ? 12 : 0)

        const imperfectCountInBatch = batchStudents.length - perfectCountInBatch

        let targetImperfectPresent = 0
        if (targetRate === 0.67 || targetRate === 0.70 || targetRate === 0.72) {
          targetImperfectPresent = Math.max(0, Math.round(batchStudents.length * targetRate - perfectCountInBatch))
        } else {
          targetImperfectPresent = Math.max(0, Math.round(imperfectCountInBatch * targetRate))
        }

        const imperfectPresentChance = imperfectCountInBatch > 0 ? (targetImperfectPresent / imperfectCountInBatch) : 0

        const records = batchStudents.map((student, idx) => {
          const isPerfect = batch === 'Grade 11-A' || batch === 'Grade 10-A' || (batch === 'Grade 11-B' && idx < 12)
          let status: 'Present' | 'Absent' | 'Late' = 'Present'

          if (isPerfect) {
            status = Math.random() > 0.9 ? 'Late' : 'Present'
          } else {
            const rand = Math.random()
            if (rand > imperfectPresentChance) {
              status = 'Absent'
            } else {
              status = Math.random() > 0.9 ? 'Late' : 'Present'
            }
          }

          return {
            studentId: student.id,
            studentName: student.name,
            rollNo: student.rollNo || '',
            status,
            notes: status === 'Absent' && Math.random() > 0.8 ? 'Unwell' : ''
          }
        })

        insertData.push({
          date,
          batch,
          subject,
          classTime: '09:00 AM - 10:00 AM',
          records
        })
      }
    }
  }
  if (insertData.length > 0) {
    await Attendance.insertMany(insertData)
  }
}

// GET — compute metrics and lists based on DB data and query filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    await seedHistoricalAttendance()

    const { searchParams } = new URL(req.url)
    const rangeDays = Number(searchParams.get('range') || '30')
    const program = searchParams.get('program') || 'All'
    const batchFilter = searchParams.get('batch') || 'All'

    // Determine query date boundary
    const dates = getLastNDaysDates(rangeDays)
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    // Construct Query
    const query: Record<string, any> = {
      date: { $gte: startDate, $lte: endDate }
    }

    if (batchFilter !== 'All') {
      query.batch = batchFilter
    } else if (program !== 'All') {
      // Map program to batches:
      // JEE Integrated -> Grade 11-A, Grade 11-B
      // Foundational -> Grade 10-A, Grade 10-B
      if (program === 'JEE Integrated') {
        query.batch = { $in: ['Grade 11-A', 'Grade 11-B'] }
      } else if (program === 'Foundational') {
        query.batch = { $in: ['Grade 10-A', 'Grade 10-B'] }
      }
    }

    // Fetch matching sheets
    const sheets = await Attendance.find(query).lean()

    // 1. Compute Overall Attendance Rate
    let totalRecords = 0
    let totalPresent = 0

    // Group rates by batch + subject for "below 75%" check
    const batchSubjectStats: Record<string, { present: number; total: number; batch: string; subject: string }> = {}

    // Track statistics per student
    const studentStats: Record<string, { name: string; batch: string; present: number; absent: number; total: number; lastAbsent: string }> = {}

    // Group rates per day for Heatmap
    const dailyStats: Record<string, { present: number; total: number }> = {}
    dates.forEach(d => {
      dailyStats[d] = { present: 0, total: 0 }
    })

    sheets.forEach(sheet => {
      const key = `${sheet.batch} • ${sheet.subject}`
      if (!batchSubjectStats[key]) {
        batchSubjectStats[key] = { present: 0, total: 0, batch: sheet.batch, subject: sheet.subject }
      }

      sheet.records.forEach((r: any) => {
        const isPresent = r.status === 'Present' || r.status === 'Late'

        // Overall
        totalRecords++
        if (isPresent) totalPresent++

        // Batch+Subject grouping
        batchSubjectStats[key].total++
        if (isPresent) batchSubjectStats[key].present++

        // Daily grouping
        if (dailyStats[sheet.date]) {
          dailyStats[sheet.date].total++
          if (isPresent) dailyStats[sheet.date].present++
        }

        // Student stats
        const studentIdStr = r.studentId.toString()
        if (!studentStats[studentIdStr]) {
          studentStats[studentIdStr] = {
            name: r.studentName,
            batch: sheet.batch,
            present: 0,
            absent: 0,
            total: 0,
            lastAbsent: ''
          }
        }
        studentStats[studentIdStr].total++
        if (isPresent) {
          studentStats[studentIdStr].present++
        } else {
          studentStats[studentIdStr].absent++
          // Update last absent date
          if (!studentStats[studentIdStr].lastAbsent || sheet.date > studentStats[studentIdStr].lastAbsent) {
            studentStats[studentIdStr].lastAbsent = sheet.date
          }
        }
      })
    })

    const overallRate = totalRecords > 0 ? Number(((totalPresent / totalRecords) * 100).toFixed(1)) : 92.4

    // 2. Count Batches Below 75%
    let batchesBelow75 = 0
    const batchesAttention: any[] = []

    Object.keys(batchSubjectStats).forEach(key => {
      const stat = batchSubjectStats[key]
      const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0

      if (rate < 75) {
        batchesBelow75++
        batchesAttention.push({
          name: stat.batch,
          subject: stat.subject.split(' ')[0], // just 'Physics', 'Chemistry', etc.
          rate,
          needsAttention: true
        })
      } else {
        batchesAttention.push({
          name: stat.batch,
          subject: stat.subject.split(' ')[0],
          rate,
          needsAttention: false
        })
      }
    })

    // Sort batches so ones needing attention are on top
    batchesAttention.sort((a, b) => a.rate - b.rate)

    // 3. Count Perfect Attendance Students
    let perfectAttendanceCount = 0
    const studentTableData: any[] = []

    Object.keys(studentStats).forEach(id => {
      const s = studentStats[id]
      if (s.absent === 0) {
        perfectAttendanceCount++
      }
      const rate = s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 100
      studentTableData.push({
        name: s.name,
        batch: s.batch,
        present: s.present,
        absent: s.absent,
        rate,
        lastAbsent: s.lastAbsent || '—'
      })
    })

    // Sort students by attendance rate ascending so low attendance is seen first, or alphabetically
    studentTableData.sort((a, b) => a.rate - b.rate)

    // 4. Map dailyStats to heatmap array format [{ date, rate }]
    const heatmap = Object.keys(dailyStats).map(d => {
      const stat = dailyStats[d]
      const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : null
      return {
        date: d,
        rate
      }
    })

    // Compute pseudo-dynamic trend relative to a baseline of 90.3% to match mockup "+2.1%" when rate is 92.4%
    const trendVal = Number((overallRate - 90.3).toFixed(1))
    const trend = trendVal >= 0 ? `+${trendVal}%` : `${trendVal}%`

    return NextResponse.json({
      overallRate,
      trend,
      batchesBelow75,
      perfectAttendanceCount,
      heatmap,
      batchesAttention: batchesAttention.slice(0, 4), // top 4 needy batches
      studentTable: studentTableData
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/attendance/overview/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/attendance/overview/route.ts app/api/attendance/overview/route.test.ts
git commit -m "feat: migrate attendance overview route's student seeding to postgres"
```

---

### Task 7: Update the `PaymentRecord` model's `studentId` field and migrate `/api/fees/payments`

**Files:**
- Modify: `models/PaymentRecord.ts`
- Modify: `app/api/fees/payments/route.ts`
- Create: `app/api/fees/payments/route.test.ts`

**Interfaces:**
- Consumes: `getStudentById` from `@/lib/db/queries/students` (Task 2).
- Produces: `IPaymentRecord.studentId` is now `string` (was `mongoose.Types.ObjectId`); the schema's `studentId` field is now `{ type: String, required: true }` (was `{ type: Schema.Types.ObjectId, ref: 'Student', required: true }`). `feeTypeId` is untouched (still references the in-scope-for-Mongo `FeeType` model).

- [ ] **Step 1: Change the `studentId` field type on the `PaymentRecord` model**

Replace `models/PaymentRecord.ts` entirely:

```ts
import mongoose, { Document, Schema } from 'mongoose'

export interface IPaymentRecord extends Document {
  studentId: string
  studentName: string
  rollNo?: string
  class?: string
  section?: string
  feeTypeId: mongoose.Types.ObjectId
  feeName: string
  amountPaid: number
  totalAmount: number
  status: 'Paid' | 'Pending' | 'Overdue'
  dueDate: Date
  paidDate?: Date
  transactionId?: string
  paymentMethod?: 'Cash' | 'Card' | 'UPI' | 'Net Banking'
  createdAt: Date
  updatedAt: Date
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    rollNo: { type: String, default: '' },
    class: { type: String, default: '' },
    section: { type: String, default: '' },
    feeTypeId: { type: Schema.Types.ObjectId, ref: 'FeeType', required: true },
    feeName: { type: String, required: true },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    transactionId: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['Cash', 'Card', 'UPI', 'Net Banking'] },
  },
  { timestamps: true }
)

export default mongoose.models.PaymentRecord || mongoose.model<IPaymentRecord>('PaymentRecord', PaymentRecordSchema)
```

- [ ] **Step 2: Write the failing test**

Create `app/api/fees/payments/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockPaymentFind = jest.fn()
const mockPaymentFindOne = jest.fn()
const mockPaymentCreate = jest.fn()
jest.mock('@/models/PaymentRecord', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => ({ sort: () => ({ lean: () => mockPaymentFind(...args) }) }),
    findOne: (...args: any[]) => mockPaymentFindOne(...args),
    create: (...args: any[]) => mockPaymentCreate(...args),
  },
}))

const mockFeeTypeFindById = jest.fn()
jest.mock('@/models/FeeType', () => ({
  __esModule: true,
  default: {
    findById: (...args: any[]) => mockFeeTypeFindById(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('GET /api/fees/payments', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/payments'))
    expect(res.status).toBe(401)
  })

  it('returns whatever PaymentRecord.find resolves', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockPaymentFind.mockResolvedValue([{ studentName: 'A' }])
    const res = await GET(req('http://localhost/api/fees/payments'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([{ studentName: 'A' }])
  })
})

describe('POST /api/fees/payments', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/fees/payments', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the Postgres student does not exist', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000000', feeTypeId: 'x', amount: 100 }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('creates a new payment record using the real Postgres student name/rollNo/class', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [student] = await db.insert(students).values({ name: 'Fee Payer', rollNo: '001', class: '11 - A', section: 'A' }).returning()
    mockFeeTypeFindById.mockResolvedValue({ _id: 'feetype1', name: 'Tuition', amount: 1000 })
    mockPaymentFindOne.mockResolvedValue(null)
    mockPaymentCreate.mockImplementation(async (data: any) => data)

    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id, feeTypeId: 'feetype1', amount: 1000 }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: student.id, studentName: 'Fee Payer', rollNo: '001', class: '11 - A', section: 'A' })
    )
    expect(body.status).toBe('Paid')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- app/api/fees/payments/route.test.ts`
Expected: FAIL — route still imports `@/models/Student`.

- [ ] **Step 4: Rewrite the route**

Replace `app/api/fees/payments/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import PaymentRecord from '@/models/PaymentRecord'
import FeeType from '@/models/FeeType'
import { auth } from '@/lib/auth'
import { getStudentById } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// GET — fetch payment records
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const query: Record<string, any> = {}
    if (status && status !== 'All') {
      query.status = status
    }

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { feeName: { $regex: search, $options: 'i' } }
      ]
    }

    const records = await PaymentRecord.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json(records)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — record a payment
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { studentId, feeTypeId, amount, paymentMethod, transactionId, dueDate } = body

    if (!studentId || !feeTypeId || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid parameters.' }, { status: 400 })
    }

    // Fetch student & fee type details
    const student = await getStudentById(studentId)
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

    const feeType = await FeeType.findById(feeTypeId)
    if (!feeType) return NextResponse.json({ error: 'Fee Type not found.' }, { status: 404 })

    // Check if a payment record already exists for this student and fee type
    let record = await PaymentRecord.findOne({ studentId, feeTypeId })

    if (record) {
      record.amountPaid += amount
      if (record.amountPaid >= record.totalAmount) {
        record.status = 'Paid'
      } else {
        // If it's overdue or pending
        const now = new Date()
        record.status = new Date(record.dueDate) < now ? 'Overdue' : 'Pending'
      }
      record.paidDate = new Date()
      if (paymentMethod) record.paymentMethod = paymentMethod
      if (transactionId) record.transactionId = transactionId
      await record.save()
    } else {
      const now = new Date()
      const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      let initialStatus: 'Paid' | 'Pending' | 'Overdue' = 'Pending'
      if (amount >= feeType.amount) {
        initialStatus = 'Paid'
      } else if (resolvedDueDate < now) {
        initialStatus = 'Overdue'
      }

      record = await PaymentRecord.create({
        studentId,
        studentName: student.name,
        rollNo: student.rollNo || '',
        class: student.class || '',
        section: student.section || '',
        feeTypeId,
        feeName: feeType.name,
        amountPaid: amount,
        totalAmount: feeType.amount,
        status: initialStatus,
        dueDate: resolvedDueDate,
        paidDate: amount > 0 ? new Date() : undefined,
        transactionId: transactionId || '',
        paymentMethod: paymentMethod || undefined
      })
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app/api/fees/payments/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add models/PaymentRecord.ts app/api/fees/payments/route.ts app/api/fees/payments/route.test.ts
git commit -m "feat: migrate fees payments route's student lookups to postgres"
```

---

### Task 8: Migrate `/api/fees/stats` to Postgres

**Files:**
- Modify: `app/api/fees/stats/route.ts`
- Create: `app/api/fees/stats/route.test.ts`

**Interfaces:**
- Consumes: `listStudents`, `bulkInsertStudents` from `@/lib/db/queries/students` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `app/api/fees/stats/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockFeeTypeCount = jest.fn()
const mockFeeTypeInsertMany = jest.fn()
jest.mock('@/models/FeeType', () => ({
  __esModule: true,
  default: {
    countDocuments: (...args: any[]) => mockFeeTypeCount(...args),
    insertMany: (...args: any[]) => mockFeeTypeInsertMany(...args),
  },
}))

const mockPaymentInsertMany = jest.fn()
const mockPaymentFind = jest.fn()
const mockPaymentCount = jest.fn()
jest.mock('@/models/PaymentRecord', () => ({
  __esModule: true,
  default: {
    insertMany: (...args: any[]) => mockPaymentInsertMany(...args),
    find: (...args: any[]) => mockPaymentFind(...args),
    countDocuments: (...args: any[]) => mockPaymentCount(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/fees/stats', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/stats'))
    expect(res.status).toBe(401)
  })

  it('seeds 60 Postgres students when fewer than 50 active students exist, then returns computed metrics', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockFeeTypeCount.mockResolvedValue(0) // triggers the seed branch
    mockFeeTypeInsertMany.mockImplementation(async (docs: any[]) => docs.map((d, i) => ({ ...d, _id: `fee${i}` })))
    mockPaymentInsertMany.mockResolvedValue([])
    mockPaymentFind.mockResolvedValue([])
    mockPaymentCount.mockResolvedValue(0)

    const res = await GET(req('http://localhost/api/fees/stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      totalCollectedThisMonth: 0,
      pendingDues: 0,
      activeStudentsWithDuesCount: 0,
      overdueAccounts: 0,
      collectionRate: 0,
    })

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(60)
  })

  it('does not reseed FeeType/students when FeeType already has rows', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockFeeTypeCount.mockResolvedValue(5)
    mockPaymentFind.mockResolvedValue([])
    mockPaymentCount.mockResolvedValue(0)

    await GET(req('http://localhost/api/fees/stats'))

    expect(mockFeeTypeInsertMany).not.toHaveBeenCalled()
    const rows = await db.select().from(students)
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/fees/stats/route.test.ts`
Expected: FAIL — route still seeds/queries via `@/models/Student`.

- [ ] **Step 3: Rewrite the route**

Replace `app/api/fees/stats/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import FeeType from '@/models/FeeType'
import PaymentRecord from '@/models/PaymentRecord'
import { auth } from '@/lib/auth'
import { listStudents, bulkInsertStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// Helper to seed database with realistic mockup data
async function seedDataIfEmpty() {
  const feeTypeCount = await FeeType.countDocuments()
  if (feeTypeCount > 0) return

  // 1. Create realistic mock students if none exist
  let students = await listStudents({ activeOnly: true })
  if (students.length < 50) {
    const firstNames = ['Karan', 'Isha', 'Rohan', 'Meera', 'Amit', 'Neha', 'Rahul', 'Priya', 'Sanjay', 'Deepa', 'Vijay', 'Anjali', 'Rajesh', 'Sunita', 'Vikram', 'Kavita', 'Arjun', 'Pooja', 'Aditya', 'Ritu']
    const lastNames = ['Sharma', 'Patel', 'Gupta', 'Kumar', 'Verma', 'Singh', 'Joshi', 'Mehta', 'Shah', 'Rao', 'Nair', 'Das', 'Sen', 'Reddy', 'Gowda', 'Mishra', 'Trivedi', 'Pandey', 'Choudhury', 'Gill']

    const newStudentsData = []
    for (let i = 0; i < 60; i++) {
      const fn = firstNames[i % firstNames.length]
      const ln = lastNames[(i + 3) % lastNames.length]
      const classNum = i % 2 === 0 ? '11' : '10'
      const sec = i % 3 === 0 ? 'A' : 'B'
      const rollNum = `24-${classNum}${sec}-0${String(i + 1).padStart(2, '0')}`

      newStudentsData.push({
        name: `${fn} ${ln}`,
        rollNo: rollNum,
        class: `${classNum} - ${sec}`,
        section: sec,
        parentContact: `+91 98765 ${String(10000 + i)}`,
        isActive: true
      })
    }
    students = await bulkInsertStudents(newStudentsData)
  }

  // 2. Create the 5 Fee Structures from the screenshot
  const structures = [
    { name: 'Registration Fee', description: 'New admissions only', programBatch: 'All Programs', amount: 5000, frequency: 'One-time', academicYear: '2024-25' },
    { name: 'Tuition Fee - Core', description: 'Standard curriculum fee', programBatch: 'JEE 2026-A', amount: 12500, frequency: 'Monthly', academicYear: '2024-25' },
    { name: 'Tuition Fee - Foundation', description: 'Foundation 10', programBatch: 'Foundation 10', amount: 8000, frequency: 'Monthly', academicYear: '2024-25' },
    { name: 'Exam Fee (Term 1)', description: 'All Programs', amount: 2500, frequency: 'Quarterly', academicYear: '2024-25' },
    { name: 'Study Material Fee', description: 'Printed modules & access', programBatch: 'JEE 2026-A', amount: 15000, frequency: 'Yearly', academicYear: '2024-25' }
  ]
  const seededStructures = await FeeType.insertMany(structures)

  const tuitionFeeCore = seededStructures.find((s: any) => s.name === 'Tuition Fee - Core')!
  const examFee = seededStructures.find((s: any) => s.name === 'Exam Fee (Term 1)')!
  const tuitionFoundation = seededStructures.find((s: any) => s.name === 'Tuition Fee - Foundation')!

  // 3. Create realistic payment records to match the mockup metrics:
  // - Total Collected: 36 paid Tuition Fee - Core of 12,500 = ₹4,50,000
  // - Overdue Accounts: 18 overdue Exam Fee of 2,500 = ₹45,000 (due in past, paid 0)
  // - Pending Accounts: 27 pending Foundation Tuition where amount = 8,000, paid = 5,000, leaving 3,000 pending = ₹81,000
  // - 1 extra pending record with 1,000 pending (amount = 8,000, paid = 7,000)
  // - Total pending dues = 45,000 + 81,000 + 1,000 = ₹1,27,000 (across 18 + 27 = 45 active students)
  // - Total Collected overall = 4,50,000 + (27 * 5,000) + 7,000 = 5,92,000. Wait! The KPI is "Total Collected This Month"
  //   Let's make sure the collections *this month* is exactly ₹4,50,000.
  //   If we set `paidDate` for the 36 tuition fee payments to the current month, and others to previous months, then "collected this month" will be exactly ₹4,50,000!

  const now = new Date()
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 5)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15)
  const pastDueDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const futureDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const paymentRecords = []

  // A. 36 Paid records (collected this month)
  for (let i = 0; i < 36; i++) {
    const student = students[i % students.length]
    paymentRecords.push({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      class: student.class,
      section: student.section,
      feeTypeId: tuitionFeeCore._id,
      feeName: tuitionFeeCore.name,
      amountPaid: 12500,
      totalAmount: 12500,
      status: 'Paid',
      dueDate: prevMonthDate,
      paidDate: currentMonthDate,
      transactionId: `TXN-${100000 + i}`,
      paymentMethod: 'UPI'
    })
  }

  // B. 18 Overdue records
  for (let i = 0; i < 18; i++) {
    const student = students[(36 + i) % students.length]
    paymentRecords.push({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      class: student.class,
      section: student.section,
      feeTypeId: examFee._id,
      feeName: examFee.name,
      amountPaid: 0,
      totalAmount: 2500,
      status: 'Overdue',
      dueDate: pastDueDate
    })
  }

  // C. 27 Pending records (with partial payments in past month)
  for (let i = 0; i < 26; i++) {
    const student = students[(i) % students.length] // Reuse students so the total unique active students with dues is exactly 45
    paymentRecords.push({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      class: student.class,
      section: student.section,
      feeTypeId: tuitionFoundation._id,
      feeName: tuitionFoundation.name,
      amountPaid: 5000,
      totalAmount: 8000,
      status: 'Pending',
      dueDate: futureDueDate,
      paidDate: prevMonthDate,
      transactionId: `TXN-${200000 + i}`,
      paymentMethod: 'Cash'
    })
  }

  // 1 extra pending record to balance the numbers exactly
  const extraStudent = students[26 % students.length]
  paymentRecords.push({
    studentId: extraStudent.id,
    studentName: extraStudent.name,
    rollNo: extraStudent.rollNo,
    class: extraStudent.class,
    section: extraStudent.section,
    feeTypeId: tuitionFoundation._id,
    feeName: tuitionFoundation.name,
    amountPaid: 7000,
    totalAmount: 8000,
    status: 'Pending',
    dueDate: futureDueDate,
    paidDate: prevMonthDate,
    transactionId: 'TXN-200026',
    paymentMethod: 'Card'
  })

  await PaymentRecord.insertMany(paymentRecords)
}

// GET — return metrics/KPI stats
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    await seedDataIfEmpty()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const collectedThisMonthRecords = await PaymentRecord.find({
      paidDate: { $gte: startOfMonth, $lte: endOfMonth }
    })

    const totalCollectedThisMonth = collectedThisMonthRecords.reduce((sum: number, r: any) => sum + r.amountPaid, 0)

    // 2. Pending Dues: sum of (totalAmount - amountPaid) for all records with status 'Pending' or 'Overdue'
    const unpaidRecords = await PaymentRecord.find({
      status: { $in: ['Pending', 'Overdue'] }
    })
    const pendingDues = unpaidRecords.reduce((sum: number, r: any) => sum + (r.totalAmount - r.amountPaid), 0)

    // Count unique students with pending dues
    const uniqueStudentsWithDues = new Set(unpaidRecords.map((r: any) => r.studentId.toString()))
    const activeStudentsWithDuesCount = uniqueStudentsWithDues.size

    // 3. Overdue Accounts: count of records with status = 'Overdue'
    const overdueCount = await PaymentRecord.countDocuments({ status: 'Overdue' })

    // 4. Collection Rate: (Total Paid Overall) / (Total Paid Overall + Pending Dues) * 100
    const allRecords = await PaymentRecord.find()
    const totalPaidOverall = allRecords.reduce((sum: number, r: any) => sum + r.amountPaid, 0)
    const totalAmountOverall = allRecords.reduce((sum: number, r: any) => sum + r.totalAmount, 0)
    const collectionRate = totalAmountOverall > 0
      ? Math.round((totalPaidOverall / totalAmountOverall) * 100)
      : 0

    return NextResponse.json({
      totalCollectedThisMonth,
      pendingDues,
      activeStudentsWithDuesCount,
      overdueAccounts: overdueCount,
      collectionRate
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/fees/stats/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/fees/stats/route.ts app/api/fees/stats/route.test.ts
git commit -m "feat: migrate fees stats route's student seeding to postgres"
```

---

### Task 9: Update the `TestResult` model's `studentId` field and migrate `/api/tests/results`

**Files:**
- Modify: `models/TestResult.ts`
- Modify: `app/api/tests/results/route.ts`
- Create: `app/api/tests/results/route.test.ts`

**Interfaces:**
- Consumes: `findStudentsByClasses` from `@/lib/db/queries/students` (Task 2).
- Produces: `IStudentResult.studentId` is now `string | undefined` (was `mongoose.Types.ObjectId | undefined`); the schema's `studentId` field is now `{ type: String, required: false }` (was `{ type: Schema.Types.ObjectId, ref: 'Student', required: false }`).

- [ ] **Step 1: Change the `studentId` field type on the `TestResult` model**

Replace `models/TestResult.ts` entirely:

```ts
import mongoose, { Document, Schema } from 'mongoose'

export interface IStudentResult {
  studentId?: string
  studentName: string
  rollNo: string
  marksObtained?: number
  correct?: number
  incorrect?: number
  unattempted?: number
  rank?: number
  percentage?: number
  absent: boolean
}

export interface ITestResult extends Document {
  testId: mongoose.Types.ObjectId
  studentResults: IStudentResult[]
  createdAt: Date
  updatedAt: Date
}

const StudentResultSchema = new Schema({
  studentId: { type: String, required: false },
  studentName: { type: String, required: true },
  rollNo: { type: String, default: '' },
  marksObtained: { type: Number },
  correct: { type: Number },
  incorrect: { type: Number },
  unattempted: { type: Number },
  rank: { type: Number },
  percentage: { type: Number },
  absent: { type: Boolean, default: false }
})

const TestResultSchema = new Schema<ITestResult>(
  {
    testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true, unique: true },
    studentResults: [StudentResultSchema]
  },
  { timestamps: true }
)

export default mongoose.models.TestResult || mongoose.model<ITestResult>('TestResult', TestResultSchema)
```

- [ ] **Step 2: Write the failing test**

Create `app/api/tests/results/route.test.ts`:

```ts
import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockTestFindById = jest.fn()
const mockTestFindOne = jest.fn()
const mockTestCreate = jest.fn()
const mockTestFindByIdAndUpdate = jest.fn()
jest.mock('@/models/Test', () => ({
  __esModule: true,
  default: {
    findById: (...args: any[]) => mockTestFindById(...args),
    findOne: (...args: any[]) => mockTestFindOne(...args),
    create: (...args: any[]) => mockTestCreate(...args),
    findByIdAndUpdate: (...args: any[]) => mockTestFindByIdAndUpdate(...args),
  },
}))

const mockResultFindOne = jest.fn()
const mockResultFindOneAndUpdate = jest.fn()
const mockResultCreate = jest.fn()
jest.mock('@/models/TestResult', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockResultFindOne(...args),
    findOneAndUpdate: (...args: any[]) => mockResultFindOneAndUpdate(...args),
    create: (...args: any[]) => mockResultCreate(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('GET /api/tests/results', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/tests/results?testId=t1'))
    expect(res.status).toBe(401)
  })

  it('rejects when testId is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/tests/results'))
    expect(res.status).toBe(400)
  })

  it('builds a template from real Postgres students for a Pending test with no saved results yet', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values({ name: 'Test Taker', class: '11 - A', rollNo: '001', isActive: true })
    mockTestFindById.mockResolvedValue({ _id: 't1', batch: '11 - A', title: 'Quiz 1', totalMarks: 100, status: 'Pending' })
    mockResultFindOne.mockResolvedValue(null)

    const res = await GET(req('http://localhost/api/tests/results?testId=t1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isNew).toBe(true)
    expect(body.studentResults).toHaveLength(1)
    expect(typeof body.studentResults[0].studentId).toBe('string')
    expect(body.studentResults[0].studentId.length).toBeGreaterThan(20)
  })
})

describe('POST /api/tests/results', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when the role is not teacher or management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/tests/results', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('saves results and updates the test status to Graded', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    mockTestFindById.mockResolvedValue({ _id: 't1', totalMarks: 100, toObject: () => ({ _id: 't1', totalMarks: 100 }) })
    mockResultFindOneAndUpdate.mockResolvedValue({ studentResults: [] })
    mockTestFindByIdAndUpdate.mockResolvedValue({})

    const res = await POST(
      req('http://localhost/api/tests/results', {
        method: 'POST',
        body: JSON.stringify({
          testId: 't1',
          studentResults: [{ studentId: 'some-uuid', studentName: 'A', rollNo: '1', marksObtained: 80, absent: false }],
        }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockTestFindByIdAndUpdate).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'Graded' }))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- app/api/tests/results/route.test.ts`
Expected: FAIL — route still imports `@/models/Student`.

- [ ] **Step 4: Rewrite the route**

Replace `app/api/tests/results/route.ts` entirely:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Test from '@/models/Test'
import TestResult from '@/models/TestResult'
import { auth } from '@/lib/auth'
import { findStudentsByClasses } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// Helper to resolve test batch name to student class names
function resolveClassFromBatch(batch: string): string {
  const b = batch.trim().toLowerCase()
  if (b.includes('2026-a') || b.includes('11-a') || b.includes('11 - a') || b.includes('grade 11-a')) return '11 - A'
  if (b.includes('2025-b') || b.includes('11-b') || b.includes('11 - b') || b.includes('grade 11-b')) return '11 - B'
  if (b.includes('2024-c') || b.includes('10-a') || b.includes('10 - a') || b.includes('grade 10-a')) return '10 - A'
  if (b.includes('foundation-x') || b.includes('10-b') || b.includes('10 - b') || b.includes('grade 10-b')) return '10 - B'
  return batch
}

// Generate a distribution of scores that has highest, lowest and a target average
function generateDistribution(count: number, highest: number, lowest: number, targetAverage: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [Math.round(targetAverage)]

  const scores: number[] = []
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1)
    scores.push(Math.round(highest - ratio * (highest - lowest)))
  }

  let currentSum = scores.reduce((a, b) => a + b, 0)
  const targetSum = Math.round(targetAverage * count)
  let diff = targetSum - currentSum

  let attempts = 0
  while (diff !== 0 && attempts < 1000) {
    attempts++
    const idx = 1 + Math.floor(Math.random() * (count - 2))
    if (diff > 0 && scores[idx] < highest) {
      scores[idx]++
      diff--
    } else if (diff < 0 && scores[idx] > lowest) {
      scores[idx]--
      diff++
    }
  }

  return scores.sort((a, b) => b - a)
}

// Function to calculate ranks dynamically
function calculateRanks(studentResults: any[]) {
  const gradedResults = studentResults
    .filter(r => !r.absent)
    .sort((a, b) => (b.marksObtained ?? 0) - (a.marksObtained ?? 0))

  const rankMap = new Map<string, number>()
  let currentRank = 1

  gradedResults.forEach((res, index) => {
    const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
    if (index > 0 && res.marksObtained !== gradedResults[index - 1].marksObtained) {
      currentRank = index + 1
    }
    rankMap.set(key, currentRank)
  })

  return studentResults.map(res => {
    if (res.absent) {
      return {
        ...res,
        rank: undefined,
        percentage: undefined
      }
    }
    const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
    return {
      ...res,
      rank: rankMap.get(key) || 1
    }
  })
}

// GET — fetch results for a given test ID
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json({ error: 'Missing testId parameter.' }, { status: 400 })
    }

    let test = await Test.findById(testId)
    if (!test) {
      // If we are looking for a mock test to seed, check if the ID requested matches 'mock-unit-test-3'
      if (testId === 'mock-unit-test-3') {
        const existingMockTest = await Test.findOne({ title: 'Unit Test 3', batch: '11 - A' })
        if (existingMockTest) {
          test = existingMockTest
        } else {
          test = await Test.create({
            title: 'Unit Test 3',
            batch: '11 - A',
            subject: 'Physics (PHY-101)',
            date: '2023-10-24',
            time: '10:00 AM',
            duration: 60,
            totalMarks: 100,
            status: 'Graded',
            averageScore: 74.5,
            testType: 'Unit Test'
          })
        }
      } else {
        return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
      }
    }

    // Check if test results already exist
    let resultDoc = await TestResult.findOne({ testId: test._id })

    const resolvedClass = resolveClassFromBatch(test.batch)
    // Fetch real students in this class
    const students = await findStudentsByClasses([resolvedClass], true)

    if (!resultDoc) {
      if (students.length === 0) {
        return NextResponse.json({ error: `No active students found in class "${resolvedClass}". Please add students first.` }, { status: 404 })
      }

      // Generate initial template records based on real students
      // We will distribute scores with highest 98, lowest 42, and average 74.5% if it's the Unit Test 3
      const isUnitTest3 = test.title === 'Unit Test 3' && resolvedClass === '11 - A'
      const presentCount = isUnitTest3 ? students.length - 1 : students.length
      const scores = isUnitTest3 ? generateDistribution(presentCount, 98, 42, 74.5) : []

      let scoreIdx = 0

      let initialRecords = students.map((st, index) => {
        // For Unit Test 3, make the third student (index 2) absent to match the mockup exactly
        const isAbsent = isUnitTest3 && index === 2

        if (isUnitTest3) {
          if (isAbsent) {
            return {
              studentId: st.id,
              studentName: st.name,
              rollNo: st.rollNo || `11A-${String(index + 1).padStart(2, '0')}`,
              marksObtained: undefined,
              correct: undefined,
              incorrect: undefined,
              unattempted: undefined,
              percentage: undefined,
              absent: true
            }
          }

          const score = scores[scoreIdx++]
          const correct = Math.round(score / 2)
          const unattempted = score % 2 === 0 ? 0 : 1
          const incorrect = Math.max(0, 50 - correct - unattempted)

          return {
            studentId: st.id,
            studentName: st.name,
            rollNo: st.rollNo || `11A-${String(index + 1).padStart(2, '0')}`,
            marksObtained: score,
            correct,
            incorrect,
            unattempted,
            percentage: (score / test.totalMarks) * 100,
            absent: false
          }
        }

        // For other tests, default to empty template values
        return {
          studentId: st.id,
          studentName: st.name,
          rollNo: st.rollNo || `${resolvedClass.replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`,
          marksObtained: undefined,
          correct: undefined,
          incorrect: undefined,
          unattempted: undefined,
          percentage: undefined,
          absent: false
        }
      })

      // Calculate ranks for the initial template records
      initialRecords = calculateRanks(initialRecords)

      // Save initial result sheet if it was a Graded test
      if (test.status === 'Graded') {
        resultDoc = await TestResult.create({
          testId: test._id,
          studentResults: initialRecords
        })
      } else {
        // Return unsaved template for upcoming/pending tests
        return NextResponse.json({
          test,
          studentResults: initialRecords,
          isNew: true
        })
      }
    }

    return NextResponse.json({
      test,
      studentResults: resultDoc.studentResults,
      isNew: false
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — save or update test results sheet
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { testId, studentResults } = body

    if (!testId || !studentResults || !Array.isArray(studentResults)) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 })
    }

    const test = await Test.findById(testId)
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    }

    // Process and validate results, calculate percentages
    const totalMarks = test.totalMarks
    let formattedResults = studentResults.map(r => {
      const marks = r.absent ? undefined : Number(r.marksObtained || 0)
      return {
        studentId: r.studentId || undefined,
        studentName: r.studentName,
        rollNo: r.rollNo || '',
        marksObtained: marks,
        correct: r.absent ? undefined : Number(r.correct || 0),
        incorrect: r.absent ? undefined : Number(r.incorrect || 0),
        unattempted: r.absent ? undefined : Number(r.unattempted || 0),
        percentage: r.absent || marks === undefined ? undefined : Math.round((marks / totalMarks) * 1000) / 10,
        absent: !!r.absent
      }
    })

    // Compute ranks dynamically
    formattedResults = calculateRanks(formattedResults)

    // Save/Upsert results in database
    const updatedResultDoc = await TestResult.findOneAndUpdate(
      { testId },
      { testId, studentResults: formattedResults },
      { new: true, upsert: true }
    )

    // Calculate class performance stats (Average Score)
    const presentStudents = formattedResults.filter(r => !r.absent && r.percentage !== undefined)
    const averageScore = presentStudents.length > 0
      ? Math.round((presentStudents.reduce((sum, r) => sum + (r.percentage || 0), 0) / presentStudents.length) * 10) / 10
      : 0

    // Update Test status and average score in DB
    await Test.findByIdAndUpdate(testId, {
      averageScore,
      status: 'Graded'
    })

    return NextResponse.json({
      success: true,
      test: { ...test.toObject(), averageScore, status: 'Graded' },
      studentResults: updatedResultDoc.studentResults
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- app/api/tests/results/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add models/TestResult.ts app/api/tests/results/route.ts app/api/tests/results/route.test.ts
git commit -m "feat: migrate test results route's student lookups to postgres"
```

---

### Task 10: Retire the `Student` Mongoose model and run a full verification pass

**Files:**
- Delete: `models/Student.ts`
- No other files modified — this task is verification-only otherwise.

**Interfaces:**
- None produced — this is the final cleanup/verification task for this plan.

- [ ] **Step 1: Confirm nothing still imports the Mongoose `Student` model**

Run: `grep -rn "models/Student'" app/ components/ lib/ models/ --include="*.ts" --include="*.tsx"`
Expected: no output. If anything matches, stop and migrate that remaining call site before continuing — it means an earlier task missed a reference.

- [ ] **Step 2: Delete the model**

```bash
git rm models/Student.ts
```

- [ ] **Step 3: Grep for any place that still assumes a 24-character ObjectId-shaped `studentId`**

Run: `grep -rn "studentId" components/ app/ models/ --include="*.ts" --include="*.tsx" | grep -iE "objectid|length.{0,5}24|\\\\{24\\\\}"`
Expected: no output (confirms nothing validates the old Mongo ObjectId format, which would break now that `studentId` is a 36-character Postgres UUID).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (the pre-existing auth/school suites plus every suite added in Tasks 1–9 of this plan).

- [ ] **Step 5: Run a full production build**

Run: `npm run build`
Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: retire mongoose student model"
```

- [ ] **Step 7: Report**

In the final task report, include:
- Confirmation that `models/Student.ts` is deleted and nothing references it.
- Confirmation that `npm test` and `npm run build` both pass cleanly.
- A note that `Attendance`, `PaymentRecord`, and `TestResult` remain on MongoDB (intentionally, out of scope for this plan) but their `studentId` field now stores a Postgres UUID string instead of a Mongo ObjectId.
- A note recommending the user manually re-run the Student Roster, Attendance, Fees, and Test Results pages in a browser to confirm the UI still works end-to-end, the same way Task 11 of the auth/school migration plan was manually verified.

---

## Self-Review Notes

- **Spec coverage:** every Mongoose call site that touches `Student` (`/api/students`, `/api/students/bulk`, `/api/attendance`, `/api/attendance/overview`, `/api/fees/payments`, `/api/fees/stats`, `/api/tests/results`) has a task. The three Mongoose models that embed a `studentId` reference (`Attendance`, `PaymentRecord`, `TestResult`) each get their field-type fix in the same task as the route that creates/reads that reference, so the model and its only writers change together.
- **Placeholder scan:** every step that changes code shows the complete file or complete new file — no "similar to Task N" shortcuts, no TODOs.
- **Type consistency:** `Student`/`NewStudent` (Task 1) flow into every query function signature in Task 2, and every route in Tasks 3–9 imports only functions defined in Task 2 with matching names. `student.id` (Postgres) vs `student._id` (wire contract) is handled consistently via the `toApiShape` helper in Task 3 and via raw `.id` access in Tasks 5–9 (those routes only ever pass `studentId` through to Mongo documents, they never return a `Student` object directly to the frontend, so no `_id` aliasing is needed there).

