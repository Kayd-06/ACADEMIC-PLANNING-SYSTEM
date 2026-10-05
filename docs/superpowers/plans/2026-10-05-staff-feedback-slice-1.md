# Staff Feedback — Slice 1 (Fix and Unify) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Feedback section trustworthy for admin and faculty: correct KPIs and lists, no permission leaks, teacher page on Postgres only, no anonymous option.

**Architecture:** Two small pure modules (`lib/feedback/stats.ts`, `lib/feedback/scope.ts`) hold the KPI/partition and teacher-scoping rules so they are unit-testable without a database. `app/api/feedback/route.ts` is rewired to use them and gets the permission fixes. The teacher page is rewritten to read only `/api/feedback`; the admin page gets small edits. No schema change in this slice.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM on Neon Postgres, Jest + ts-jest (`npm test`), Tailwind, lucide-react.

**Spec:** [docs/superpowers/specs/2026-10-05-staff-feedback-management-design.md](../specs/2026-10-05-staff-feedback-management-design.md) (this plan implements "Slice 1" only)

## Global Constraints

- Statuses are exactly `Submitted | Reviewed | Actioned | Dismissed`. `Resolved` is never written.
- Pending = `Submitted` + `Reviewed`. Actioned = `Actioned` + `Dismissed`. Every row is in exactly one.
- No anonymous feedback: sender's real name is always stored and shown; `isAnonymous` in any request body is ignored (stored as `false`).
- Only `Management -> Teacher` and `Teacher -> Management` rows are shown/counted in the UI. `Student -> Teacher` / `Parent -> School` rows stay in the table and the Excel bulk-upload path keeps working, but they are hidden.
- Bulk upload (`action: 'bulk'`) is management-only (403 for teachers).
- A teacher only ever receives their own sent items; no other teacher's rows.
- All queries stay school-scoped (`eq(feedback.schoolId, schoolId)`); null-school rows are invisible to a school-scoped caller.
- No schema/migration change in this slice. `/api/teacher/feedback` (Mongo) is not deleted here — only its callers are removed.
- Commit messages: Conventional Commits style (`feat(feedback): ...`), **no `Co-Authored-By` line and no Claude footer** (user preference).
- Tests run against the real test DB (`TEST_DATABASE_URL` in `.env.local`); `jest.setup.ts` points `DATABASE_URL` at it. Never run DB-backed tests without it set.

## Review Focus

The spec implies these but they are easy to miss. Each has a pinning test in the task named in brackets.

1. Teacher whose session `name`/`email` is empty must not match every personalised message (old code did `batch.includes('')` and `subject === ''`). Expected: sees only broadcasts, sent list empty. [Task 2]
2. Feedback with `school_id = NULL` must not appear for a school-scoped admin. [Task 3]
3. Malformed `date` values (`''`, `'2026-1-5'`, `'garbage'`) must not crash KPIs or count as "this month". [Task 1]
4. Empty feedback set or a row with rating `0` must not produce `NaN` or skew the average/distribution. [Task 1]
5. Unknown `view` or `type` query values: unknown `view` behaves as `pending`; a `type` that is not a staff flow (e.g. `Student -> Teacher`) returns an empty list, not an error. [Task 3]

Known limitation (documented, not fixed until slice 2): two teachers with the identical display name share a "sent" list, because slice 1 has no `sender_user_id`.

## File Structure

| File | Responsibility |
|---|---|
| `lib/feedback/stats.ts` (create) | Staff-flow types, Pending/Actioned partition, KPI + distribution computation |
| `lib/feedback/stats.test.ts` (create) | Unit tests for the above |
| `lib/feedback/scope.ts` (create) | Which rows a teacher receives / sent |
| `lib/feedback/scope.test.ts` (create) | Unit tests for the above |
| `app/api/feedback/route.ts` (modify) | Use the modules; bulk management-only; ignore anonymity |
| `app/api/feedback/route.test.ts` (create) | DB-backed permission/KPI tests |
| `components/dashboard/teacher/TeacherFeedbackView.tsx` (rewrite) | Postgres-only teacher page: inbox, send, my sent |
| `lib/navigation.tsx` (modify) | Add Feedback to `TEACHER_NAV` |
| `components/dashboard/management/FeedbackManagementView.tsx` (modify) | Real month KPI, hide student/parent tabs, always show names |

---

### Task 0: Branch and commit the design docs

**Files:**
- Add: `docs/superpowers/specs/2026-10-05-staff-feedback-management-design.md`
- Add: `docs/superpowers/plans/2026-10-05-staff-feedback-slice-1.md`

- [ ] **Step 1: Create the feature branch** (repo is on `main`; `next-env.d.ts` has an unrelated local change — leave it unstaged)

```bash
git switch -c feat/staff-feedback-slice-1
```

- [ ] **Step 2: Commit only the two docs**

```bash
git add docs/superpowers/specs/2026-10-05-staff-feedback-management-design.md docs/superpowers/plans/2026-10-05-staff-feedback-slice-1.md
git commit -m "docs(feedback): add staff feedback design spec and slice 1 plan"
```

---

### Task 1: KPI and Pending/Actioned logic (`lib/feedback/stats.ts`)

**Files:**
- Create: `lib/feedback/stats.ts`
- Test: `lib/feedback/stats.test.ts`

**Interfaces:**
- Consumes: `Feedback` type from `@/lib/db/schema`.
- Produces (used by Task 3):
  - `STAFF_FLOW_TYPES: readonly ['Teacher -> Management', 'Management -> Teacher']`
  - `isStaffFlow(type: string): boolean`
  - `filterByView(items: Feedback[], view: string): Feedback[]` — `'actioned'` → Actioned+Dismissed, anything else → Submitted+Reviewed
  - `computeFeedbackStats(items: Feedback[], now: Date): FeedbackStats`
  - `interface FeedbackStats { totalCount: number; thisMonthCount: number; avgRating: number; pendingCount: number; actionedCount: number; ratingDistribution: Record<number, number> }` (distribution values are whole-number percentages for keys 5..1)

- [ ] **Step 1: Write the failing test** — create `lib/feedback/stats.test.ts`

```ts
import type { Feedback } from '@/lib/db/schema'
import { STAFF_FLOW_TYPES, isStaffFlow, filterByView, computeFeedbackStats } from './stats'

function row(o: Partial<Feedback> = {}): Feedback {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    senderName: 'Sender',
    isAnonymous: false,
    rating: 5,
    content: 'content',
    type: 'Teacher -> Management',
    status: 'Submitted',
    subject: '',
    batch: '',
    category: '',
    date: '2026-10-10',
    schoolId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    ...o,
  }
}

const NOW = new Date('2026-10-15T12:00:00Z')

describe('isStaffFlow', () => {
  it('accepts only the two staff flows', () => {
    expect(STAFF_FLOW_TYPES).toEqual(['Teacher -> Management', 'Management -> Teacher'])
    expect(isStaffFlow('Teacher -> Management')).toBe(true)
    expect(isStaffFlow('Management -> Teacher')).toBe(true)
    expect(isStaffFlow('Student -> Teacher')).toBe(false)
    expect(isStaffFlow('Parent -> School')).toBe(false)
    expect(isStaffFlow('')).toBe(false)
  })
})

describe('filterByView', () => {
  const statuses = ['Submitted', 'Reviewed', 'Actioned', 'Dismissed']

  it('puts every status in exactly one of pending / actioned', () => {
    for (const status of statuses) {
      const items = [row({ status })]
      const inPending = filterByView(items, 'pending').length
      const inActioned = filterByView(items, 'actioned').length
      expect(inPending + inActioned).toBe(1)
    }
  })

  it('pending = Submitted + Reviewed; actioned = Actioned + Dismissed', () => {
    const items = statuses.map(status => row({ status }))
    expect(filterByView(items, 'pending').map(i => i.status).sort()).toEqual(['Reviewed', 'Submitted'])
    expect(filterByView(items, 'actioned').map(i => i.status).sort()).toEqual(['Actioned', 'Dismissed'])
  })

  it('treats an unknown view as pending', () => {
    const items = statuses.map(status => row({ status }))
    expect(filterByView(items, 'bogus')).toEqual(filterByView(items, 'pending'))
    expect(filterByView(items, '')).toEqual(filterByView(items, 'pending'))
  })
})

describe('computeFeedbackStats', () => {
  it('counts only well-formed dates in the current month', () => {
    const items = [
      row({ date: '2026-10-01' }),
      row({ date: '2026-10-31' }),
      row({ date: '2026-09-30' }),
      row({ date: '2020-10-15' }),
      row({ date: '2026-1-5' }),
      row({ date: '' }),
      row({ date: 'garbage' }),
    ]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.totalCount).toBe(7)
    expect(stats.thisMonthCount).toBe(2)
  })

  it('computes pending and actioned counts from the same partition as the lists', () => {
    const items = [
      row({ status: 'Submitted' }),
      row({ status: 'Reviewed' }),
      row({ status: 'Actioned' }),
      row({ status: 'Dismissed' }),
      row({ status: 'Dismissed' }),
    ]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.pendingCount).toBe(2)
    expect(stats.actionedCount).toBe(3)
    expect(stats.pendingCount).toBe(filterByView(items, 'pending').length)
    expect(stats.actionedCount).toBe(filterByView(items, 'actioned').length)
  })

  it('averages and distributes only rows with a valid 1-5 rating', () => {
    const items = [row({ rating: 5 }), row({ rating: 5 }), row({ rating: 4 }), row({ rating: 0 })]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.avgRating).toBe(4.7)
    expect(stats.ratingDistribution).toEqual({ 5: 67, 4: 33, 3: 0, 2: 0, 1: 0 })
  })

  it('returns zeros, never NaN, for an empty set', () => {
    const stats = computeFeedbackStats([], NOW)
    expect(stats).toEqual({
      totalCount: 0,
      thisMonthCount: 0,
      avgRating: 0,
      pendingCount: 0,
      actionedCount: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    })
  })

  it('returns zero average when no row has a valid rating', () => {
    const stats = computeFeedbackStats([row({ rating: 0 })], NOW)
    expect(stats.avgRating).toBe(0)
    expect(stats.ratingDistribution).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/feedback/stats.test.ts`
Expected: FAIL — `Cannot find module './stats'`

- [ ] **Step 3: Write the implementation** — create `lib/feedback/stats.ts`

```ts
import type { Feedback } from '@/lib/db/schema'

// Only the two staff flows are shown in the UI for now. Student/Parent rows stay in the table.
export const STAFF_FLOW_TYPES = ['Teacher -> Management', 'Management -> Teacher'] as const

const PENDING_STATUSES = ['Submitted', 'Reviewed']
const ACTIONED_STATUSES = ['Actioned', 'Dismissed']

export interface FeedbackStats {
  totalCount: number
  thisMonthCount: number
  avgRating: number
  pendingCount: number
  actionedCount: number
  ratingDistribution: Record<number, number>
}

export function isStaffFlow(type: string): boolean {
  return (STAFF_FLOW_TYPES as readonly string[]).includes(type)
}

// Any view other than 'actioned' is treated as 'pending'.
export function filterByView(items: Feedback[], view: string): Feedback[] {
  const statuses = view === 'actioned' ? ACTIONED_STATUSES : PENDING_STATUSES
  return items.filter(i => statuses.includes(i.status))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function computeFeedbackStats(items: Feedback[], now: Date): FeedbackStats {
  const monthPrefix = now.toISOString().slice(0, 7)
  const rated = items.filter(i => Number.isFinite(i.rating) && i.rating >= 1 && i.rating <= 5)

  const avgRating = rated.length > 0
    ? Number((rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1))
    : 0

  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  rated.forEach(i => { counts[Math.round(i.rating)]++ })
  const ratingDistribution: Record<number, number> = {}
  for (const stars of [5, 4, 3, 2, 1]) {
    ratingDistribution[stars] = rated.length > 0 ? Math.round((counts[stars] / rated.length) * 100) : 0
  }

  return {
    totalCount: items.length,
    thisMonthCount: items.filter(i => ISO_DATE.test(i.date) && i.date.startsWith(monthPrefix)).length,
    avgRating,
    pendingCount: filterByView(items, 'pending').length,
    actionedCount: filterByView(items, 'actioned').length,
    ratingDistribution,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/feedback/stats.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/stats.ts lib/feedback/stats.test.ts
git commit -m "feat(feedback): add KPI and pending/actioned partition helpers"
```

---

### Task 2: Teacher scoping (`lib/feedback/scope.ts`)

**Files:**
- Create: `lib/feedback/scope.ts`
- Test: `lib/feedback/scope.test.ts`

**Interfaces:**
- Consumes: `Feedback` type from `@/lib/db/schema`.
- Produces (used by Task 3): `splitTeacherFeedback(items: Feedback[], teacher: { name: string; email: string }): { received: Feedback[]; sent: Feedback[] }`

Rules (kept from the existing route; the ID-based version arrives in slice 2):
- `received`: type `Management -> Teacher` and (`batch` empty, or `batch === 'All Faculty'`, or `batch` contains the teacher's name, or `subject` equals the teacher's email). Name/email comparison is case-insensitive and only applied when the teacher's name/email is non-empty.
- `sent`: type `Teacher -> Management` and `senderName` equals the teacher's name (case-insensitive). Empty name → empty list.

- [ ] **Step 1: Write the failing test** — create `lib/feedback/scope.test.ts`

```ts
import type { Feedback } from '@/lib/db/schema'
import { splitTeacherFeedback } from './scope'

function row(o: Partial<Feedback> = {}): Feedback {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    senderName: 'Sender',
    isAnonymous: false,
    rating: 5,
    content: 'content',
    type: 'Management -> Teacher',
    status: 'Submitted',
    subject: '',
    batch: '',
    category: '',
    date: '2026-10-10',
    schoolId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    ...o,
  }
}

const alice = { name: 'Alice Teacher', email: 'alice@school.test' }

describe('splitTeacherFeedback — received', () => {
  it('includes broadcasts (empty batch or "All Faculty") for every teacher', () => {
    const items = [row({ batch: '' }), row({ batch: 'All Faculty' })]
    expect(splitTeacherFeedback(items, alice).received).toHaveLength(2)
    expect(splitTeacherFeedback(items, { name: 'Bob', email: 'bob@school.test' }).received).toHaveLength(2)
  })

  it('includes feedback addressed to the teacher by name or by email', () => {
    const byName = row({ batch: 'Alice Teacher', subject: 'Physics' })
    const byEmail = row({ batch: 'Someone Else', subject: 'ALICE@school.test' })
    const result = splitTeacherFeedback([byName, byEmail], alice).received
    expect(result).toEqual([byName, byEmail])
  })

  it('excludes feedback addressed to another teacher', () => {
    const toBob = row({ batch: 'Bob Teacher', subject: 'bob@school.test' })
    expect(splitTeacherFeedback([toBob], alice).received).toEqual([])
  })

  it('ignores Teacher -> Management rows', () => {
    const up = row({ type: 'Teacher -> Management', batch: '' })
    expect(splitTeacherFeedback([up], alice).received).toEqual([])
  })

  it('with an empty name and email, receives broadcasts only', () => {
    const broadcast = row({ batch: 'All Faculty' })
    const personal = row({ batch: 'Alice Teacher', subject: '' })
    const noSubject = row({ batch: 'Bob Teacher', subject: '' })
    const result = splitTeacherFeedback([broadcast, personal, noSubject], { name: '', email: '' })
    expect(result.received).toEqual([broadcast])
  })
})

describe('splitTeacherFeedback — sent', () => {
  it('returns only the caller\'s own Teacher -> Management rows (case-insensitive)', () => {
    const mine = row({ type: 'Teacher -> Management', senderName: 'alice teacher' })
    const theirs = row({ type: 'Teacher -> Management', senderName: 'Bob Teacher' })
    const wrongType = row({ type: 'Management -> Teacher', senderName: 'Alice Teacher' })
    expect(splitTeacherFeedback([mine, theirs, wrongType], alice).sent).toEqual([mine])
  })

  it('returns nothing when the teacher name is empty', () => {
    const blank = row({ type: 'Teacher -> Management', senderName: '' })
    expect(splitTeacherFeedback([blank], { name: '', email: 'a@b.test' }).sent).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/feedback/scope.test.ts`
Expected: FAIL — `Cannot find module './scope'`

- [ ] **Step 3: Write the implementation** — create `lib/feedback/scope.ts`

```ts
import type { Feedback } from '@/lib/db/schema'

interface TeacherIdentity {
  name: string
  email: string
}

function isAddressedTo(item: Feedback, name: string, email: string): boolean {
  const batch = (item.batch ?? '').trim()
  if (!batch || batch === 'All Faculty') return true
  if (name && batch.toLowerCase().includes(name)) return true
  if (email && (item.subject ?? '').trim().toLowerCase() === email) return true
  return false
}

// Slice 1: name/email matching only. Slice 2 replaces this with target_teacher_id / sender_user_id.
export function splitTeacherFeedback(items: Feedback[], teacher: TeacherIdentity) {
  const name = teacher.name.trim().toLowerCase()
  const email = teacher.email.trim().toLowerCase()

  const received = items.filter(i => i.type === 'Management -> Teacher' && isAddressedTo(i, name, email))
  const sent = name
    ? items.filter(i => i.type === 'Teacher -> Management' && i.senderName.trim().toLowerCase() === name)
    : []

  return { received, sent }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/feedback/scope.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/scope.ts lib/feedback/scope.test.ts
git commit -m "feat(feedback): scope teacher inbox and sent list to the caller"
```

---

### Task 3: Rewire `/api/feedback` (permissions, KPIs, no anonymity)

**Files:**
- Modify: `app/api/feedback/route.ts` (replace whole file)
- Test: `app/api/feedback/route.test.ts` (create)

**Interfaces:**
- Consumes: `STAFF_FLOW_TYPES`, `isStaffFlow`, `computeFeedbackStats`, `filterByView` from Task 1; `splitTeacherFeedback` from Task 2.
- Produces (used by Tasks 4–5):
  - Teacher `GET /api/feedback` → `{ received: Feedback[], sent: Feedback[] }`
  - Management `GET /api/feedback?type=<All|staff type>&view=<pending|actioned>` → `{ totalCount, thisMonthCount, avgRating, pendingCount, actionedCount, ratingDistribution, feedbackList }`
  - `POST` bulk → 403 for non-management.

- [ ] **Step 1: Write the failing tests** — create `app/api/feedback/route.test.ts`

```ts
import { db } from '@/lib/db'
import { feedback, schools } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn(), notifyUsers: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

function asUser(user: Record<string, unknown> | null) {
  ;(auth as jest.Mock).mockResolvedValue(user ? { user } : null)
}

function postBody(body: unknown) {
  return req('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const today = () => new Date().toISOString().slice(0, 10)

const schoolIds: string[] = []
const nullSchoolRowIds: string[] = []

async function makeSchool() {
  const [s] = await db.insert(schools).values({ name: 'Feedback Test School' }).returning()
  schoolIds.push(s.id)
  return s.id
}

async function seed(schoolId: string | null, o: Partial<typeof feedback.$inferInsert> = {}) {
  const [created] = await db.insert(feedback).values({
    senderName: 'Someone',
    rating: 4,
    content: 'seeded feedback',
    type: 'Teacher -> Management',
    status: 'Submitted',
    date: today(),
    schoolId,
    ...o,
  }).returning()
  if (schoolId === null) nullSchoolRowIds.push(created.id)
  return created
}

afterEach(async () => {
  if (schoolIds.length > 0) {
    await db.delete(feedback).where(inArray(feedback.schoolId, schoolIds))
    await db.delete(schools).where(inArray(schools.id, schoolIds))
    schoolIds.length = 0
  }
  if (nullSchoolRowIds.length > 0) {
    await db.delete(feedback).where(inArray(feedback.id, nullSchoolRowIds))
    nullSchoolRowIds.length = 0
  }
  jest.clearAllMocks()
})

describe('POST /api/feedback', () => {
  it('rejects bulk upload from a teacher and inserts nothing', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const res = await POST(postBody({ action: 'bulk', items: [{ content: 'fake', type: 'Management -> Teacher' }] }))
    expect(res.status).toBe(403)

    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const list = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(list.totalCount).toBe(0)
  })

  it('allows bulk upload from management and never stores anonymity', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const res = await POST(postBody({
      action: 'bulk',
      items: [{ content: 'from sheet', type: 'Teacher -> Management', senderName: 'Carol', isAnonymous: true }],
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.count).toBe(1)
    expect(body.created[0].isAnonymous).toBe(false)
    expect(body.created[0].senderName).toBe('Carol')
  })

  it('stores the real sender name even when isAnonymous is sent', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const res = await POST(postBody({ content: 'Need a projector', rating: 4, isAnonymous: true }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.senderName).toBe('Alice Teacher')
    expect(body.isAnonymous).toBe(false)
    expect(body.type).toBe('Teacher -> Management')
  })
})

describe('GET /api/feedback as teacher', () => {
  it('returns only the caller\'s own sent items and the feedback addressed to them', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { senderName: 'Alice Teacher', content: 'alice up' })
    await seed(schoolId, { senderName: 'Bob Teacher', content: 'bob up' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'All Faculty', content: 'broadcast' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'Bob Teacher', subject: 'bob@school.test', content: 'for bob' })

    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const body = await (await GET(req('http://localhost/api/feedback'))).json()

    expect(body.sent.map((f: any) => f.content)).toEqual(['alice up'])
    expect(body.received.map((f: any) => f.content)).toEqual(['broadcast'])
  })
})

describe('GET /api/feedback as management', () => {
  const admin = (schoolId: string) => ({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })

  it('counts only this month for the monthly KPI', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { date: today() })
    await seed(schoolId, { date: '2020-01-01' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.totalCount).toBe(2)
    expect(body.thisMonthCount).toBe(1)
  })

  it('keeps Reviewed in the pending view only', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Reviewed' })
    asUser(admin(schoolId))
    const pending = await (await GET(req('http://localhost/api/feedback?view=pending'))).json()
    const actioned = await (await GET(req('http://localhost/api/feedback?view=actioned'))).json()
    expect(pending.feedbackList).toHaveLength(1)
    expect(actioned.feedbackList).toHaveLength(0)
    expect(pending.pendingCount).toBe(1)
    expect(pending.actionedCount).toBe(0)
  })

  it('lists Actioned and Dismissed in the actioned view', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Actioned' })
    await seed(schoolId, { status: 'Dismissed' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback?view=actioned'))).json()
    expect(body.feedbackList).toHaveLength(2)
    expect(body.actionedCount).toBe(2)
    expect(body.pendingCount).toBe(0)
  })

  it('treats an unknown view as pending', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Submitted' })
    await seed(schoolId, { status: 'Actioned' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback?view=bogus'))).json()
    expect(body.feedbackList.map((f: any) => f.status)).toEqual(['Submitted'])
  })

  it('hides student and parent feedback from lists and KPIs', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { type: 'Student -> Teacher' })
    await seed(schoolId, { type: 'Parent -> School' })
    await seed(schoolId, { type: 'Teacher -> Management' })
    asUser(admin(schoolId))

    const all = await (await GET(req('http://localhost/api/feedback?type=All'))).json()
    expect(all.totalCount).toBe(1)
    expect(all.feedbackList).toHaveLength(1)

    const student = await (await GET(req(`http://localhost/api/feedback?type=${encodeURIComponent('Student -> Teacher')}`))).json()
    expect(student.feedbackList).toEqual([])
  })

  it('does not return other schools\' rows or rows with no school', async () => {
    const schoolId = await makeSchool()
    const otherSchoolId = await makeSchool()
    await seed(schoolId, { content: 'mine' })
    await seed(otherSchoolId, { content: 'other school' })
    await seed(null, { content: 'no school' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.feedbackList.map((f: any) => f.content)).toEqual(['mine'])
    expect(body.totalCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify the right ones fail**

Run: `npx jest app/api/feedback/route.test.ts`
Expected: FAIL. At minimum these fail against the current route: "rejects bulk upload from a teacher" (gets 201), "stores the real sender name…" (isAnonymous true), "returns only the caller's own sent items" (sees Bob's), "counts only this month" (`thisMonthCount` undefined), "keeps Reviewed in the pending view only" (also in actioned), "hides student and parent feedback". If a test errors on inserting into `schools` (a required column with no default), add that column to `makeSchool()` — do not change the route to fit.

- [ ] **Step 3: Replace `app/api/feedback/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'
import { STAFF_FLOW_TYPES, isStaffFlow, computeFeedbackStats, filterByView } from '@/lib/feedback/stats'
import { splitTeacherFeedback } from '@/lib/feedback/scope'

export const dynamic = 'force-dynamic'

// All interaction flows the table can hold (bulk upload may still carry student/parent rows)
const FLOW_TYPES = ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management', 'Management -> Teacher']
// Process statuses per spec
const PROCESS_STATUSES = ['Submitted', 'Reviewed', 'Actioned', 'Dismissed']

const STATUS_PRIORITY: Record<string, number> = { Submitted: 1, Reviewed: 2, Actioned: 3, Dismissed: 4 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  const schoolId = (session.user as any).schoolId as string | null

  // Teachers see only the staff flows that involve them: feedback addressed to them, and feedback they sent up
  if (role === 'teacher') {
    const conditions = [inArray(feedback.type, [...STAFF_FLOW_TYPES])]
    if (schoolId) conditions.push(eq(feedback.schoolId, schoolId))
    const items = await db.select().from(feedback).where(and(...conditions))
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return NextResponse.json(splitTeacherFeedback(items, {
      name: session.user?.name || '',
      email: session.user?.email || '',
    }))
  }

  if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'All'
  const view = searchParams.get('view') || 'pending'

  const allItems = schoolId
    ? await db.select().from(feedback).where(eq(feedback.schoolId, schoolId))
    : await db.select().from(feedback)

  // Student/parent rows stay in the table but are hidden from the UI for now
  const staffItems = allItems.filter(i => isStaffFlow(i.type))
  const stats = computeFeedbackStats(staffItems, new Date())

  const byType = type === 'All' ? staffItems : staffItems.filter(i => i.type === type)
  const feedbackList = filterByView(byType, view)
  feedbackList.sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 4
    const bp = STATUS_PRIORITY[b.status] ?? 4
    if (ap !== bp) return ap - bp
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return NextResponse.json({ ...stats, feedbackList })
}

// POST — create feedback.
// Management sends 'Management -> Teacher'; teachers send 'Teacher -> Management'.
// Feedback is never anonymous: the sender's real name is always stored.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'management' && role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schoolId = (session.user as any).schoolId as string | null
  const body = await req.json()

  // Bulk upload via Excel / CSV is management-only
  if (body.action === 'bulk' && Array.isArray(body.items)) {
    if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const toInsert = body.items.map((i: any) => ({
      senderName: i.senderName?.trim() || 'Anonymous',
      isAnonymous: false,
      rating: typeof i.rating === 'number' && !isNaN(i.rating) && i.rating >= 1 && i.rating <= 5 ? i.rating : 5,
      content: i.content?.trim() || 'General feedback',
      type: FLOW_TYPES.includes(i.type) ? i.type : 'Student -> Teacher',
      status: 'Submitted',
      subject: i.subject?.trim() || '',
      batch: i.batch?.trim() || '',
      category: i.category?.trim() || 'Academics',
      date: i.date?.trim() || new Date().toISOString().split('T')[0],
      schoolId,
    })).filter((i: any) => i.content !== '')

    if (toInsert.length === 0) return NextResponse.json({ error: 'No valid rows to insert' }, { status: 400 })
    const created = await db.insert(feedback).values(toInsert).returning()
    return NextResponse.json({ count: created.length, created }, { status: 201 })
  }

  const { content, rating, subject, batch, category } = body

  if (!content?.trim()) return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 })
  const parsedRating = Number(rating)
  if (rating !== undefined && (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const type = role === 'management' ? 'Management -> Teacher' : 'Teacher -> Management'
  const [created] = await db.insert(feedback).values({
    senderName: session.user.name ?? '',
    isAnonymous: false,
    rating: rating !== undefined ? parsedRating : 5,
    content: content.trim(),
    type,
    status: 'Submitted',
    subject: subject?.trim() || '',
    batch: batch?.trim() || '',
    category: category?.trim() || '',
    date: new Date().toISOString().split('T')[0],
    schoolId,
  }).returning()

  // Notify the receiving side's inbox
  if (type === 'Management -> Teacher') {
    const titleText = batch && batch !== 'All Faculty'
      ? `New personalised feedback from management for ${batch}`
      : 'New feedback from management'
    await notifyRoleInSchool(['teacher'], schoolId, {
      category: 'General',
      title: titleText,
      message: created.content.slice(0, 200),
      link: '/teacher/feedback',
    })
  } else {
    await notifyRoleInSchool(['management'], schoolId, {
      category: 'General',
      title: `New feedback from ${created.senderName || 'a teacher'}`,
      message: created.content.slice(0, 200),
      link: '/management/feedback',
    })
  }

  return NextResponse.json(created, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  if (!PROCESS_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${PROCESS_STATUSES.join(', ')}` }, { status: 400 })
  }

  const condition = schoolId ? and(eq(feedback.id, id), eq(feedback.schoolId, schoolId)) : eq(feedback.id, id)
  const [updated] = await db.update(feedback).set({ status, updatedAt: new Date() }).where(condition).returning()
  if (!updated) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })

  return NextResponse.json(updated)
}

// DELETE — remove a feedback entry (management only)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(feedback.id, id), eq(feedback.schoolId, schoolId)) : eq(feedback.id, id)
  await db.delete(feedback).where(condition)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/api/feedback/route.test.ts lib/feedback`
Expected: PASS (route tests + both unit-test files)

- [ ] **Step 5: Commit**

```bash
git add app/api/feedback/route.ts app/api/feedback/route.test.ts
git commit -m "fix(feedback): management-only bulk upload, no anonymity, correct KPIs and scoping"
```

---

### Task 4: Teacher page on Postgres only, plus sidebar entry

**Files:**
- Modify (replace whole file): `components/dashboard/teacher/TeacherFeedbackView.tsx`
- Modify: `lib/navigation.tsx:3` (import) and `lib/navigation.tsx:36` (nav item)

**Interfaces:**
- Consumes: teacher `GET /api/feedback` → `{ received, sent }`; `POST /api/feedback` `{ content, rating, category }` (Task 3).
- Produces: default export `TeacherFeedbackView` (same name, no props) — `app/(dashboard)/teacher/feedback/page.tsx` already imports it.

This is UI, and the repo has no component tests, so verification is a type-check plus a grep that nothing still calls the Mongo route.

- [ ] **Step 1: Replace `components/dashboard/teacher/TeacherFeedbackView.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Star, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/date'

interface FeedbackRow {
  id: string
  senderName: string
  rating: number
  content: string
  status: string
  category?: string | null
  date: string
}

const STATUS_BADGE: Record<string, string> = {
  Submitted: 'bg-slate-100 text-slate-600 border-slate-200',
  Reviewed: 'bg-amber-50 text-amber-700 border-amber-200',
  Actioned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Dismissed: 'bg-slate-50 text-slate-400 border-slate-100',
}

function formatFeedbackDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`
  return formatDate(d)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'}`} />
      ))}
    </div>
  )
}

export default function TeacherFeedbackView() {
  const [received, setReceived] = useState<FeedbackRow[]>([])
  const [sent, setSent] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showSend, setShowSend] = useState(false)
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(5)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function fetchFeedback() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to load feedback.')
        return
      }
      setReceived(Array.isArray(data.received) ? data.received : [])
      setSent(Array.isArray(data.sent) ? data.sent : [])
    } catch {
      setError('Network error. Failed to load feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeedback() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setSendError('Feedback content is required.'); return }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, rating, category: 'General' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error || 'Failed to send feedback.')
        return
      }
      setShowSend(false)
      setContent('')
      setRating(5)
      fetchFeedback()
    } catch {
      setSendError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-64px)] bg-gray-50 flex flex-col font-sans">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Feedback</h1>
          <p className="text-sm text-slate-500 mt-1">Feedback from management, and feedback you have sent to management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchFeedback}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => { setSendError(''); setShowSend(v => !v) }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors">
            {showSend ? 'Close' : 'Send Feedback to Management'}
          </button>
        </div>
      </div>

      {showSend && (
        <form onSubmit={handleSend} className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
          {sendError && <p className="text-xs text-rose-600 font-semibold">{sendError}</p>}
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="Suggestions, requests, or concerns for management…"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 focus:bg-white resize-none" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                  <Star className={`w-5 h-5 transition-colors ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 fill-transparent'}`} />
                </button>
              ))}
            </div>
            <button type="submit" disabled={sending}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Your name is shown to management with this feedback.</p>
        </form>
      )}

      {error ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
          <button onClick={fetchFeedback} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition">
            Retry
          </button>
        </div>
      ) : loading && received.length === 0 && sent.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center text-slate-400 gap-2">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Loading feedback…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">From Management ({received.length})</p>
            {received.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No feedback from management yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
                {received.map(f => (
                  <div key={f.id} className="bg-violet-50/50 border border-violet-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-xs font-bold text-slate-800">{f.senderName || 'Management'}</span>
                      <Stars rating={f.rating} />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">"{f.content}"</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-semibold">
                      {f.category && <span>{f.category}</span>}
                      <span>{f.category ? '· ' : ''}{formatFeedbackDate(f.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Sent to Management ({sent.length})</p>
            {sent.length === 0 ? (
              <p className="text-xs text-slate-400 italic">You haven't sent any feedback yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
                {sent.map(f => (
                  <div key={f.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <Stars rating={f.rating} />
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_BADGE[f.status] ?? STATUS_BADGE.Submitted}`}>
                        {f.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed italic">"{f.content}"</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-2">{formatFeedbackDate(f.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the Feedback item to the teacher sidebar** — in `lib/navigation.tsx`

Change the import on line 3 to include `MessageSquareText`:

```tsx
import { LayoutDashboard, Users, BookOpen, ShieldCheck, UserCircle, Calendar, GraduationCap, BarChart2, ClipboardList, ClipboardCheck, CreditCard, FileQuestion, CheckSquare, MessageSquare, MessageSquareText, HeartHandshake, Bell, BookText, FileCheck, ListTodo, Award } from 'lucide-react'
```

Add this line to `TEACHER_NAV` immediately before the `Counseling Log` entry:

```tsx
  { label: 'Feedback', href: '/teacher/feedback', icon: <MessageSquareText className="w-4 h-4" /> },
```

- [ ] **Step 3: Verify nothing calls the Mongo route any more**

Run: `git grep -n "api/teacher/feedback" -- app components lib ':!app/api/teacher/feedback'`
Expected: no output.

- [ ] **Step 4: Type-check and lint the changed files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "TeacherFeedbackView|navigation|feedback" || echo "no type errors in changed files"`
Run: `npx eslint components/dashboard/teacher/TeacherFeedbackView.tsx lib/navigation.tsx app/api/feedback lib/feedback`
Expected: no errors in changed files (ignore pre-existing warnings elsewhere).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/teacher/TeacherFeedbackView.tsx lib/navigation.tsx
git commit -m "feat(teacher): feedback page reads Postgres only, add sidebar entry"
```

---

### Task 5: Admin page — real month KPI, staff tabs only, names always shown

**Files:**
- Modify: `components/dashboard/management/FeedbackManagementView.tsx`

**Interfaces:**
- Consumes: management `GET /api/feedback` response (Task 3) — uses `thisMonthCount`.
- Produces: nothing new.

UI change, no component tests in the repo; verify with type-check and a manual pass. Apply each edit with the Edit tool (all `old` strings below are unique in the file at the time of writing).

- [ ] **Step 1: Initial state includes `thisMonthCount`, and the tab type drops student/parent**

Replace:
```tsx
  const [data, setData] = useState<any>({ totalCount: 0, avgRating: 0, pendingCount: 0, actionedCount: 0, ratingDistribution: {}, feedbackList: [] })
```
with:
```tsx
  const [data, setData] = useState<any>({ totalCount: 0, thisMonthCount: 0, avgRating: 0, pendingCount: 0, actionedCount: 0, ratingDistribution: {}, feedbackList: [] })
```

Replace:
```tsx
  const [activeTab, setActiveTab] = useState<'All' | 'Student -> Teacher' | 'Parent -> School' | 'Teacher -> Management' | 'Management -> Teacher'>('All')
```
with:
```tsx
  const [activeTab, setActiveTab] = useState<'All' | 'Teacher -> Management' | 'Management -> Teacher'>('All')
```

- [ ] **Step 2: Monthly KPI card uses the real monthly count**

Replace:
```tsx
            <span className="text-3xl font-extrabold text-slate-900 mt-2 block">{data.totalCount}</span>
```
with:
```tsx
            <span className="text-3xl font-extrabold text-slate-900 mt-2 block">{data.thisMonthCount}</span>
```

- [ ] **Step 3: Remove the Student/Parent tabs**

Replace:
```tsx
              { id: 'All', label: 'All' },
              { id: 'Student -> Teacher', label: 'Student → Teacher' },
              { id: 'Parent -> School', label: 'Parent → School' },
              { id: 'Teacher -> Management', label: 'Teacher → Management' },
```
with:
```tsx
              { id: 'All', label: 'All' },
              { id: 'Teacher -> Management', label: 'Teacher → Management' },
```

- [ ] **Step 4: Always show the sender's name (no anonymous avatar or label)**

View the `getProfileIcon` function (around lines 259–271) and replace it with:

```tsx
  function getProfileIcon(name: string) {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    return (
      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold text-xs shadow-sm border border-emerald-200/50 shrink-0">
        {initials}
      </div>
    )
  }
```

Replace **both** occurrences of `getProfileIcon(item.senderName, item.isAnonymous)` with `getProfileIcon(item.senderName)` (use `replace_all`).

Replace the occurrence in the table:
```tsx
                                  {item.isAnonymous ? 'Anonymous' : item.senderName}
```
with:
```tsx
                                  {item.senderName}
```

Replace the occurrence in the card:
```tsx
<span className="text-[13px] font-bold text-slate-800">{item.isAnonymous ? 'Anonymous' : item.senderName}</span>
```
with:
```tsx
<span className="text-[13px] font-bold text-slate-800">{item.senderName}</span>
```

Replace in the search filter:
```tsx
      (item.isAnonymous ? 'anonymous' : item.senderName.toLowerCase()).includes(q) ||
```
with:
```tsx
      item.senderName.toLowerCase().includes(q) ||
```

- [ ] **Step 5: Copy matches the new scope**

Replace:
```tsx
            <p className="text-[13px] text-slate-500 mt-1">Review feedback from students, parents, and staff</p>
```
with:
```tsx
            <p className="text-[13px] text-slate-500 mt-1">Review feedback exchanged between management and faculty</p>
```

Replace:
```tsx
                  <p className="text-xs text-slate-400 mt-0.5">All investigated, reviewed, and dismissed entries</p>
```
with:
```tsx
                  <p className="text-xs text-slate-400 mt-0.5">All actioned and dismissed entries</p>
```

The Status Legend card is already accurate; leave it alone.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "FeedbackManagementView" || echo "no type errors in FeedbackManagementView"`
Run: `npx eslint components/dashboard/management/FeedbackManagementView.tsx`
Expected: no new errors. `User` and `BookOpen` icons are still used further down the file, so no unused-import errors are expected; if eslint reports one, remove only that import.

- [ ] **Step 7: Run the whole feedback test set once more**

Run: `npx jest lib/feedback app/api/feedback`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/management/FeedbackManagementView.tsx
git commit -m "fix(feedback): monthly KPI, hide student/parent tabs, always show sender names"
```

- [ ] **Step 9: Manual pass (record the result in the PR description)**

With `npm run dev`: as management open `/management/feedback` — KPI "This Month" matches rows dated this month; a `Reviewed` item is only in Pending; tabs show All / Teacher → Management / Management → Teacher; sender names always visible. Send feedback to a teacher. As that teacher open `/teacher/feedback` (also reachable from the new sidebar entry) — the message appears under "From Management"; send feedback up; it appears under "Sent to Management" and not for another teacher; there is no anonymous checkbox.

---

## Self-Review

**Spec coverage (Slice 1 list):**
- `POST` bulk management-only → Task 3.
- Teacher `sent` filtered to caller; `received` keeps name/email matching → Tasks 2–3.
- Teacher page Postgres-only, Mongo block / fake 4.8 / dead Filter / Acknowledge removed, read + send only → Task 4.
- KPI month filter, Pending/Actioned overlap and counters → Tasks 1, 3, 5.
- Remove anonymous from teacher form and API; admin always shows names → Tasks 3, 4, 5.
- Feedback in teacher sidebar → Task 4.
- Student/parent hidden in UI → Tasks 3 (data) and 5 (tabs).
- Deliberately not in slice 1 (per spec): Sentiment Keywords card (still hardcoded; replaced in slice 2), schema columns, replies, faculty-ID targeting, deleting `/api/teacher/feedback`.

**Placeholders:** none; every code step carries full code.

**Type consistency:** `STAFF_FLOW_TYPES`, `isStaffFlow`, `filterByView`, `computeFeedbackStats`, `FeedbackStats` (Task 1) and `splitTeacherFeedback` (Task 2) are used with the same names and signatures in Task 3. `thisMonthCount` is produced in Task 1/3 and consumed in Task 5.
