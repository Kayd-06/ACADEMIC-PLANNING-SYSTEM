# Faculty CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Faculty" tab to Academic Planning that lists all faculty for the admin's active school and lets them bulk-import faculty (including batch assignments) from a CSV/Excel sheet, idempotently.

**Architecture:** A new bulk API endpoint (`app/api/teacher-portal/faculty/bulk/route.ts`) follows the existing `app/api/students/bulk/route.ts` pattern — `Promise.allSettled` over parsed rows, per-row `FieldError` reporting, non-blocking batch-name validation. A new dedicated upload modal (`FacultyCsvUploadModal.tsx`) follows the structure of the existing `CsvUploadModal.tsx` (drag-drop, template download, client-side preview validation, result panel) with faculty-specific fields and no default pickers. A new self-contained `FacultyTab.tsx` (matching the self-containment of `SchoolsTab.tsx`/`BatchesTab.tsx`) fetches the existing `GET /api/teacher-portal/faculty`, renders the list, and owns its own "Import CSV" button and modal state. `AcademicPlanningView.tsx` gains a 5th tab entry wiring it in.

**Tech Stack:** Next.js App Router API routes, Drizzle ORM (`drizzle-orm/neon-http`) against Neon serverless Postgres, `xlsx` (SheetJS) for client-side parsing, React + Tailwind + framer-motion for UI, Jest (`testEnvironment: node`, live test DB, `maxWorkers: 1`) for API route tests.

## Global Constraints

- No schema changes — reuse `faculty`, `teacherBatches`, `batches` tables exactly as they exist in `lib/db/schema.ts` today.
- Auth: the bulk import endpoint is management-role only (mirrors the existing `POST /api/teacher-portal/faculty`, unlike student bulk import which also allows `teacher`).
- Required fields: `name`, `subject`, `specialization`. Missing any of these on a row rejects that row with a field error — this is the only case where a whole row is rejected.
- Batch-name validation is non-blocking: an unmatched batch name is reported as a `field: 'batches'` error but never blocks the rest of that row (profile fields and any valid batch names in the same cell still save).
- Re-import must be idempotent: match existing faculty by `employeeId` first, falling back to `email`; if neither is present, always insert new. On a Postgres `23505` unique-violation during insert, catch it and retry once as an update (handles two rows in the same file sharing an Employee ID).
- Sparse update: on a match, only fields present and non-empty in the row are written — never blank out previously-set data.
- Batch assignment is add-only: never remove a `teacherBatches` row a re-imported sheet doesn't mention; never insert a duplicate `(teacherId, batchName)` pair.
- `faculty.batches` (the legacy integer count column) must equal the real current count of that teacher's `teacherBatches` rows after every write, not just the rows touched by this import.
- Response shape: `{ succeeded, failed, total, errors: FieldError[] }`, where `FieldError = { row, field, value, message }` and `field` is one of `'name' | 'subject' | 'specialization' | 'batches' | 'general'`.
- No edit/delete UI in the new Faculty tab — list + import only; manual CRUD stays on the existing Teacher Portal → Faculty Directory page.
- No "School" column in the CSV — scoping is via `(session.user as any).schoolId`, matching the existing `app/api/teacher-portal/faculty/route.ts` convention exactly (not the `getSchoolId()` helper).
- No "Class" validation — no such entity exists for faculty.

---

## File Structure

- **Create:** `app/api/teacher-portal/faculty/bulk/route.ts` — the bulk import `POST` handler.
- **Create:** `app/api/teacher-portal/faculty/bulk/route.test.ts` — integration tests against the live test DB.
- **Create:** `components/dashboard/management/FacultyCsvUploadModal.tsx` — drag-drop upload modal with client-side preview validation.
- **Create:** `components/dashboard/management/FacultyTab.tsx` — self-contained faculty list + "Import CSV" entry point.
- **Modify:** `components/dashboard/management/AcademicPlanningView.tsx` — add the `FacultyTab` import, add `'Faculty'` to the tabs array, add its render block.

---

### Task 1: Bulk faculty import API endpoint

**Files:**
- Create: `app/api/teacher-portal/faculty/bulk/route.ts`
- Test: `app/api/teacher-portal/faculty/bulk/route.test.ts`

**Interfaces:**
- Consumes: `faculty`, `teacherBatches`, `batches` tables and `NewFaculty`/`Faculty` types from `@/lib/db/schema`; `auth` from `@/lib/auth`; `db` from `@/lib/db`.
- Produces: `POST` handler at `/api/teacher-portal/faculty/bulk`. Request body: `{ faculty: any[] }` (array of parsed CSV rows, each a flat object of string fields including `name`, `subject`, `specialization`, `employeeId`, `email`, `batches` [comma-separated names], plus the rest of the faculty profile fields). Response: `{ succeeded: number, failed: number, total: number, errors: FieldError[] }` with status 201 on success, 401/403/400/500 on error paths. This is the endpoint `FacultyCsvUploadModal.tsx` (Task 3) posts to.

- [ ] **Step 1: Write the failing test file**

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { faculty, teacherBatches, batches, schools } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/teacher-portal/faculty/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}

async function cleanupByEmployeeId(employeeId: string) {
  const rows = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
  for (const r of rows) {
    await db.delete(teacherBatches).where(eq(teacherBatches.teacherId, r.id))
    await db.delete(faculty).where(eq(faculty.id, r.id))
  }
}

describe('POST /api/teacher-portal/faculty/bulk', () => {
  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req({ faculty: [{ name: 'X', subject: 'Physics', specialization: 'Mechanics' }] }))
    expect(res.status).toBe(403)
  })

  it('rejects an empty array', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ faculty: [] }))
    expect(res.status).toBe(400)
  })

  it('skips a row missing a required field and reports which field is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ faculty: [{ name: '', subject: 'Physics', specialization: 'Mechanics' }] }))
    const body = await res.json()
    expect(body.succeeded).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors[0].field).toBe('name')
  })

  it('saves the row and reports only the unknown batch name when one of two batch names is invalid', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [batch] = await db.insert(batches).values({ name: 'JEE Batch A' }).returning()
    const employeeId = `EMP-${Date.now()}-1`
    try {
      const res = await POST(req({
        faculty: [{ name: 'Batch Mix', subject: 'Physics', specialization: 'Mechanics', employeeId, batches: 'JEE Batch A, Nonexistent Batch' }],
      }))
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed).toBe(0)
      expect(body.errors).toHaveLength(1)
      expect(body.errors[0].field).toBe('batches')
      expect(body.errors[0].value).toBe('Nonexistent Batch')

      const [created] = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      const assignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, created.id))
      expect(assignments).toHaveLength(1)
      expect(assignments[0].batchName).toBe('JEE Batch A')
    } finally {
      await cleanupByEmployeeId(employeeId)
      await db.delete(batches).where(eq(batches.id, batch.id))
    }
  })

  it('updates the existing faculty row instead of duplicating it when re-imported by Employee ID', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const employeeId = `EMP-${Date.now()}-2`
    try {
      await POST(req({ faculty: [{ name: 'First Name', subject: 'Physics', specialization: 'Mechanics', employeeId }] }))
      await POST(req({ faculty: [{ name: 'Updated Name', subject: 'Physics', specialization: 'Mechanics', employeeId }] }))

      const rows = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('Updated Name')
    } finally {
      await cleanupByEmployeeId(employeeId)
    }
  })

  it('does not duplicate a batch assignment already on the teacher when re-imported', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [batch] = await db.insert(batches).values({ name: 'Repeat Batch' }).returning()
    const employeeId = `EMP-${Date.now()}-3`
    try {
      const row = { name: 'Repeat Import', subject: 'Physics', specialization: 'Mechanics', employeeId, batches: 'Repeat Batch' }
      await POST(req({ faculty: [row] }))
      await POST(req({ faculty: [row] }))

      const [created] = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      const assignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, created.id))
      expect(assignments).toHaveLength(1)
    } finally {
      await cleanupByEmployeeId(employeeId)
      await db.delete(batches).where(eq(batches.id, batch.id))
    }
  })

  it('matches and updates by Email when no Employee ID is given', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const email = `email-match-${Date.now()}@example.com`
    try {
      await POST(req({ faculty: [{ name: 'Email First', subject: 'Physics', specialization: 'Mechanics', email }] }))
      await POST(req({ faculty: [{ name: 'Email Updated', subject: 'Physics', specialization: 'Mechanics', email }] }))

      const rows = await db.select().from(faculty).where(eq(faculty.email, email))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('Email Updated')
    } finally {
      const rows = await db.select().from(faculty).where(eq(faculty.email, email))
      for (const r of rows) {
        await db.delete(teacherBatches).where(eq(teacherBatches.teacherId, r.id))
        await db.delete(faculty).where(eq(faculty.id, r.id))
      }
    }
  })

  it('applies the second of two same-file rows sharing an Employee ID as an update, not a failed insert', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const employeeId = `EMP-${Date.now()}-4`
    try {
      const res = await POST(req({
        faculty: [
          { name: 'Race First', subject: 'Physics', specialization: 'Mechanics', employeeId },
          { name: 'Race Second', subject: 'Chemistry', specialization: 'Organic', employeeId },
        ],
      }))
      const body = await res.json()
      expect(body.succeeded).toBe(2)
      expect(body.failed).toBe(0)

      const rows = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('Race Second')
    } finally {
      await cleanupByEmployeeId(employeeId)
    }
  })

  it('keeps faculty.batches equal to the real total assignment count, including assignments from a prior import', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [batchA] = await db.insert(batches).values({ name: 'Count Batch A' }).returning()
    const [batchB] = await db.insert(batches).values({ name: 'Count Batch B' }).returning()
    const employeeId = `EMP-${Date.now()}-5`
    try {
      await POST(req({ faculty: [{ name: 'Count Test', subject: 'Physics', specialization: 'Mechanics', employeeId, batches: 'Count Batch A' }] }))
      await POST(req({ faculty: [{ name: 'Count Test', subject: 'Physics', specialization: 'Mechanics', employeeId, batches: 'Count Batch B' }] }))

      const [created] = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      expect(created.batches).toBe(2)
    } finally {
      await cleanupByEmployeeId(employeeId)
      await db.delete(batches).where(eq(batches.id, batchA.id))
      await db.delete(batches).where(eq(batches.id, batchB.id))
    }
  })

  it('scopes matching and batch validation by schoolId', async () => {
    const schoolId = '33333333-3333-3333-3333-333333333333'
    const otherSchoolId = '44444444-4444-4444-4444-444444444444'
    await db.insert(schools).values({ id: schoolId as any })
    await db.insert(schools).values({ id: otherSchoolId as any })
    const [otherSchoolBatch] = await db.insert(batches).values({ name: 'Other School Batch', schoolId: otherSchoolId as any }).returning()
    const employeeId = `EMP-${Date.now()}-6`
    await db.insert(faculty).values({ name: 'Other School Teacher', subject: 'Physics', specialization: 'Mechanics', employeeId, schoolId: otherSchoolId as any })
    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId } })
      const res = await POST(req({
        faculty: [{ name: 'Cross School', subject: 'Physics', specialization: 'Mechanics', employeeId, batches: 'Other School Batch' }],
      }))
      const body = await res.json()
      // Different school's Employee ID doesn't match → inserted as new, not an update
      expect(body.succeeded).toBe(1)
      expect(body.errors[0].field).toBe('batches')

      const rows = await db.select().from(faculty).where(eq(faculty.employeeId, employeeId))
      expect(rows).toHaveLength(2)
    } finally {
      await cleanupByEmployeeId(employeeId)
      await db.delete(batches).where(eq(batches.id, otherSchoolBatch.id))
      await db.delete(schools).where(eq(schools.id, schoolId as any))
      await db.delete(schools).where(eq(schools.id, otherSchoolId as any))
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/teacher-portal/faculty/bulk/route.test.ts`
Expected: FAIL — `Cannot find module './route'` (the route file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty, teacherBatches, batches, type NewFaculty, type Faculty } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface FieldError {
  row: string
  field: 'name' | 'subject' | 'specialization' | 'batches' | 'general'
  value: string
  message: string
}

class ValidationError extends Error {
  field: 'name' | 'subject' | 'specialization'
  value: string
  constructor(field: 'name' | 'subject' | 'specialization', value: string, message: string) {
    super(message)
    this.field = field
    this.value = value
  }
}

// Every faculty field the manual "Add Faculty" form and CSV template support,
// excluding name/subject/specialization (required, handled separately) and
// batches (a comma-separated names cell here, not the legacy count column).
const FACULTY_ROW_FIELDS = [
  'employeeId', 'email', 'phone', 'altPhone', 'dob', 'gender',
  'addressLine1', 'city', 'state', 'pincode',
  'qualification', 'primaryStream', 'joiningDate', 'bio', 'profileImgUrl',
] as const

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can import faculty' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { faculty: rows } = body as { faculty: any[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No faculty data provided' }, { status: 400 })
    }

    // Batch names must match a real, school-scoped record — same convention
    // as Program/Batch validation for students.
    const schoolBatches = schoolId
      ? await db.select().from(batches).where(eq(batches.schoolId, schoolId))
      : await db.select().from(batches)
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))

    const rowLabels = rows.map((r: any, i: number) => r.name?.trim() || `Row ${i + 1}`)
    const batchErrors: (FieldError | null)[] = rows.map(() => null)

    const results = await Promise.allSettled(
      rows.map(async (r: any, i: number) => {
        const name = r.name?.trim() || ''
        const subject = r.subject?.trim() || ''
        const specialization = r.specialization?.trim() || ''
        if (!name) throw new ValidationError('name', '', 'Name is required')
        if (!subject) throw new ValidationError('subject', '', 'Subject is required')
        if (!specialization) throw new ValidationError('specialization', '', 'Specialization is required')

        const employeeId = r.employeeId?.trim() || ''
        const email = r.email?.trim() || ''

        // Batch validation is non-blocking: bad names are reported but the
        // row (and any valid batch names in the same cell) still saves.
        const requestedBatchNames = (r.batches?.trim() || '')
          .split(',')
          .map((b: string) => b.trim())
          .filter(Boolean)
        const validBatches: typeof schoolBatches = []
        const invalidBatchNames: string[] = []
        for (const bn of requestedBatchNames) {
          const match = batchByName.get(bn.toLowerCase())
          if (match) validBatches.push(match)
          else invalidBatchNames.push(bn)
        }
        if (invalidBatchNames.length > 0) {
          batchErrors[i] = {
            row: rowLabels[i],
            field: 'batches',
            value: invalidBatchNames.join(', '),
            message: `Batch(es) not found: ${invalidBatchNames.join(', ')}. Create them first in Academic Planning, or fix the spelling.`,
          }
        }

        const data: Record<string, any> = { name, subject, specialization }
        for (const f of FACULTY_ROW_FIELDS) {
          const v = r[f]
          if (typeof v === 'string' && v.trim()) data[f] = v.trim()
        }
        const statusValue = r.status?.trim() || ''
        if (statusValue) {
          data.status = statusValue.toUpperCase()
          data.isActive = statusValue.toUpperCase() !== 'INACTIVE'
        }
        const experienceYearsValue = r.experienceYears?.trim() || ''
        if (experienceYearsValue) {
          data.experienceYears = Number(experienceYearsValue) || null
          data.experience = `${data.experienceYears} years`
        }

        // Match on the most reliable key available: Employee ID, then Email.
        // Neither present → always insert new.
        let existing: Faculty | undefined
        if (employeeId) {
          const cond = schoolId ? and(eq(faculty.employeeId, employeeId), eq(faculty.schoolId, schoolId)) : eq(faculty.employeeId, employeeId)
          const matches = await db.select().from(faculty).where(cond)
          existing = matches[0]
        } else if (email) {
          const cond = schoolId ? and(eq(faculty.email, email), eq(faculty.schoolId, schoolId)) : eq(faculty.email, email)
          const matches = await db.select().from(faculty).where(cond)
          existing = matches[0]
        }

        let teacherId: string
        if (existing) {
          const [updated] = await db.update(faculty)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(faculty.id, existing.id))
            .returning()
          teacherId = updated.id
        } else {
          try {
            const [created] = await db.insert(faculty).values({
              ...(data as NewFaculty),
              schoolId,
            }).returning()
            teacherId = created.id
          } catch (error: any) {
            // Two rows in this file shared an Employee ID and raced — the
            // first insert already created the row; apply this row as an update.
            if ((error.code === '23505' || error.cause?.code === '23505') && employeeId) {
              const cond = schoolId ? and(eq(faculty.employeeId, employeeId), eq(faculty.schoolId, schoolId)) : eq(faculty.employeeId, employeeId)
              const retryMatches = await db.select().from(faculty).where(cond)
              const retried = retryMatches[0]
              if (!retried) throw error
              const [updated] = await db.update(faculty)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(faculty.id, retried.id))
                .returning()
              teacherId = updated.id
            } else {
              throw error
            }
          }
        }

        // Add-only batch assignment: never remove an assignment this sheet
        // doesn't mention, never duplicate one it does.
        if (validBatches.length > 0) {
          const existingAssignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, teacherId))
          const existingNames = new Set(existingAssignments.map((a) => a.batchName.trim().toLowerCase()))
          for (const b of validBatches) {
            if (!existingNames.has(b.name.trim().toLowerCase())) {
              await db.insert(teacherBatches).values({
                teacherId,
                batchName: b.name,
                subjectName: subject,
                role: 'primary',
                assignedAt: new Date().toISOString().split('T')[0],
              })
              existingNames.add(b.name.trim().toLowerCase())
            }
          }
        }

        // Legacy count column must reflect the real current total, not just
        // this row's new names, so it stays correct across repeated imports.
        const totalAssignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, teacherId))
        await db.update(faculty).set({ batches: totalAssignments.length }).where(eq(faculty.id, teacherId))

        return teacherId
      })
    )

    const errors: FieldError[] = []
    results.forEach((r, i) => {
      if (batchErrors[i]) errors.push(batchErrors[i]!)
      if (r.status !== 'rejected') return
      const reason = r.reason
      if (reason instanceof ValidationError) {
        errors.push({ row: rowLabels[i], field: reason.field, value: reason.value, message: reason.message })
      } else {
        errors.push({ row: rowLabels[i], field: 'general', value: '', message: reason?.message || String(reason) })
      }
    })
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (failed > 0) {
      console.error('Faculty bulk import failures:', errors)
    }

    return NextResponse.json({ succeeded, failed, total: rows.length, errors }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/teacher-portal/faculty/bulk/route.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/api/teacher-portal/faculty/bulk/route.ts app/api/teacher-portal/faculty/bulk/route.test.ts
git commit -m "feat: add faculty CSV bulk import API endpoint"
```

---

### Task 2: Faculty CSV upload modal

**Files:**
- Create: `components/dashboard/management/FacultyCsvUploadModal.tsx`

**Interfaces:**
- Consumes: `POST /api/teacher-portal/faculty/bulk` (Task 1) with body `{ faculty: ParsedRow[] }`, response `{ succeeded, failed, total, errors }`. Fetches `GET /api/batches` for client-side preview validation (returns `{ id, name, ... }[]`, already used by `CsvUploadModal.tsx` for the same purpose).
- Produces: `export default function FacultyCsvUploadModal({ onClose, onImported }: { onClose: () => void; onImported: () => void })`. Consumed by `FacultyTab.tsx` (Task 3).

No test file for this component — mirrors the existing `CsvUploadModal.tsx`, which also has no test file in this codebase; component-level testing isn't the established convention here.

- [ ] **Step 1: Write the component**

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'

interface ParsedRow {
  name: string
  employeeId: string
  email: string
  phone: string
  altPhone: string
  dob: string
  gender: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  subject: string
  specialization: string
  qualification: string
  primaryStream: string
  experienceYears: string
  joiningDate: string
  status: string
  batches: string
  bio: string
  profileImgUrl: string
}

interface FacultyCsvUploadModalProps {
  onClose: () => void
  onImported: () => void
}

export const TEMPLATE_HEADERS = [
  'Name', 'Employee ID', 'Email', 'Phone', 'Alt Phone',
  'Date of Birth (YYYY-MM-DD)', 'Gender',
  'Address Line 1', 'City', 'State', 'Pincode',
  'Subject', 'Specialization', 'Qualification', 'Primary Stream',
  'Experience (Years)', 'Joining Date (YYYY-MM-DD)', 'Status', 'Batches',
  'Bio', 'Profile Image URL',
]

export function downloadTemplate() {
  const data = [
    TEMPLATE_HEADERS,
    [
      'Anita Rao', 'EMP-201', 'anita.rao@example.com', '9876500011', '9876500012',
      '1985-03-14', 'Female',
      '22 Park Street', 'Ahmedabad', 'Gujarat', '380001',
      'Physics', 'Mechanics', 'M.Sc. Physics', 'JEE',
      '8', '2020-06-01', 'ACTIVE', 'JEE Batch A, JEE Batch B',
      'Specializes in mechanics and thermodynamics.', '',
    ],
    ['Vikram Singh', '', '', '', '', '', '', '', '', '', '', 'Chemistry', 'Organic Chemistry', '', '', '', '', 'ACTIVE', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(14, Math.min(28, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Faculty')
  XLSX.writeFile(wb, 'faculty_import_template.xlsx')
}

export default function FacultyCsvUploadModal({ onClose, onImported }: FacultyCsvUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [realBatches, setRealBatches] = useState<any[]>([])

  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await fetch('/api/batches')
        const data = await res.json()
        if (Array.isArray(data)) setRealBatches(data)
      } catch (err) {
        console.error('Failed to load batches', err)
      }
    }
    loadBatches()
  }, [])

  const batchNameSet = new Set(realBatches.map((b) => String(b.name).trim().toLowerCase()))

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    succeeded: number
    failed: number
    total: number
    errors: { row: string; field: string; value: string; message: string }[]
  } | null>(null)

  // Local preview check — the server re-validates authoritatively regardless
  // of what this finds.
  function rowValidation(row: ParsedRow): { name?: string; subject?: string; specialization?: string; batches?: string } {
    const errors: { name?: string; subject?: string; specialization?: string; batches?: string } = {}
    if (!row.name) errors.name = 'Name is required.'
    if (!row.subject) errors.subject = 'Subject is required.'
    if (!row.specialization) errors.specialization = 'Specialization is required.'
    const requestedNames = row.batches.split(',').map((b) => b.trim()).filter(Boolean)
    const invalidNames = requestedNames.filter((b) => !batchNameSet.has(b.toLowerCase()))
    if (invalidNames.length > 0) {
      errors.batches = `${invalidNames.join(', ')} — not found. Create in Academic Planning first.`
    }
    return errors
  }

  const rowsWithErrors = parsedRows.filter((r) => {
    const v = rowValidation(r)
    return !!(v.name || v.subject || v.specialization || v.batches)
  }).length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setParsedRows([])
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const rows: ParsedRow[] = raw
          .map((r) => {
            const keys = Object.keys(r)
            const get = (variants: string[]) => {
              for (const v of variants) {
                const found = keys.find((k) => k.toLowerCase().replace(/[\s()_-]+/g, '') === v.toLowerCase())
                if (found) return String(r[found]).trim()
              }
              return ''
            }
            return {
              name: get(['name', 'facultyname', 'teachername']),
              employeeId: get(['employeeid', 'empid']),
              email: get(['email']),
              phone: get(['phone', 'mobile']),
              altPhone: get(['altphone', 'alternatephone']),
              dob: get(['dateofbirthyyyymmdd', 'dateofbirth', 'dob']),
              gender: get(['gender']),
              addressLine1: get(['addressline1', 'address']),
              city: get(['city']),
              state: get(['state']),
              pincode: get(['pincode', 'zip', 'zipcode']),
              subject: get(['subject']),
              specialization: get(['specialization']),
              qualification: get(['qualification']),
              primaryStream: get(['primarystream', 'stream']),
              experienceYears: get(['experienceyears', 'experience']),
              joiningDate: get(['joiningdateyyyymmdd', 'joiningdate']),
              status: get(['status']),
              batches: get(['batches', 'batch']),
              bio: get(['bio']),
              profileImgUrl: get(['profileimageurl', 'profileimgurl', 'photourl']),
            }
          })
          .filter((r) => r.name || r.subject || r.specialization)

        if (rows.length === 0) {
          setError('No valid rows found. Make sure at least a Name column exists.')
          return
        }
        setParsedRows(rows)
      } catch (err) {
        setError('Failed to parse file. Please use the provided template or a standard Excel/CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/teacher-portal/faculty/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty: parsedRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
        return
      }
      setResult(data)
      setParsedRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImported()
    } catch {
      setError('Import failed. Please check your connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-2xl border border-slate-250 max-h-[90vh] overflow-y-auto space-y-5"
      >
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900">Import Faculty from CSV / Excel</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all rounded-2xl p-7 flex flex-col items-center justify-center cursor-pointer text-center group space-y-2"
        >
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500 group-hover:scale-105 transition-transform">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Drag & drop your Excel/CSV here</p>
            <p className="text-[10px] text-slate-450 mt-1">or click to browse from your device</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          id="faculty-csv-upload-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex justify-between items-center bg-slate-50/60 px-4 py-3.5 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Format template</span>
          </div>
          <button onClick={downloadTemplate} className="text-xs text-indigo-655 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download Sample CSV
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              Import complete! {result.succeeded} imported, {result.failed} failed out of {result.total} rows.
            </div>
            {result.errors.length > 0 && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}><span className="font-bold">{e.row}:</span> {e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="mt-4 space-y-3.5">
            <p className="text-xs font-bold text-slate-800">Preview — {parsedRows.length} rows</p>
            {rowsWithErrors > 0 && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                {rowsWithErrors} row{rowsWithErrors === 1 ? '' : 's'} have a problem — see highlighted cells below.
              </div>
            )}
            <div className="border border-slate-150 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-inner bg-slate-50/30">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-150">
                  <tr>
                    {['Name', 'Employee ID', 'Subject', 'Specialization', 'Batches', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px] bg-slate-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => {
                    const rowErrors = rowValidation(r)
                    return (
                      <tr key={i} className="hover:bg-slate-50/70 bg-white">
                        <td className={`px-3.5 py-2 font-bold ${rowErrors.name ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-800'}`} title={rowErrors.name}>
                          {r.name || '—'}
                        </td>
                        <td className="px-3.5 py-2 font-semibold text-slate-500">{r.employeeId || '—'}</td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.subject ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.subject}>
                          {r.subject || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.specialization ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.specialization}>
                          {r.specialization || '—'}
                        </td>
                        <td className={`px-3.5 py-2 font-semibold ${rowErrors.batches ? 'text-red-600 bg-red-50 border border-red-200 rounded' : 'text-slate-500'}`} title={rowErrors.batches}>
                          {r.batches || '—'}
                        </td>
                        <td className="px-3.5 py-2 text-slate-450">{r.status || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-[#0b1320] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer transform active:scale-[0.98]"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing...' : `Import ${parsedRows.length} Faculty`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds cleanly**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/management/FacultyCsvUploadModal.tsx
git commit -m "feat: add faculty CSV upload modal"
```

---

### Task 3: Faculty tab component

**Files:**
- Create: `components/dashboard/management/FacultyTab.tsx`

**Interfaces:**
- Consumes: `GET /api/teacher-portal/faculty` (existing, returns each faculty row joined with `subjects`, `batchAssignments: {id, teacherId, batchName, subjectName, role, assignedAt}[]`, `programAssignments`). Imports `FacultyCsvUploadModal` (Task 2) with props `{ onClose, onImported }`.
- Produces: `export default function FacultyTab()` — no props, self-contained (matches `SchoolsTab.tsx`/`BatchesTab.tsx`). Consumed by `AcademicPlanningView.tsx` (Task 4).

- [ ] **Step 1: Write the component**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import FacultyCsvUploadModal from './FacultyCsvUploadModal'

export default function FacultyTab() {
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { fetchFaculty() }, [])

  async function fetchFaculty() {
    setLoading(true)
    try {
      const res = await fetch('/api/teacher-portal/faculty')
      const data = await res.json()
      if (Array.isArray(data)) setFacultyList(data)
    } catch (err) {
      console.error('Failed to fetch faculty', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-[13px] text-slate-500">
          {facultyList.length} faculty member{facultyList.length === 1 ? '' : 's'} across all batches
        </p>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0b1320] hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <Upload className="w-4 h-4" /> Import CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : facultyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <p className="text-sm">No faculty found. Import a CSV to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Employee ID', 'Subject / Specialization', 'Batches', 'Status'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facultyList.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 font-bold text-slate-900">{f.name}</td>
                  <td className="px-6 py-4 text-slate-500">{f.employeeId || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{f.subject}{f.specialization ? ` — ${f.specialization}` : ''}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {(f.batchAssignments || []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        f.batchAssignments.map((b: any) => (
                          <span key={b.id} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded-md">
                            {b.batchName}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                      f.status === 'ACTIVE' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      f.status === 'ON_LEAVE' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-700 bg-slate-50'
                    }`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <FacultyCsvUploadModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchFaculty() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it builds cleanly**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/management/FacultyTab.tsx
git commit -m "feat: add faculty list tab component"
```

---

### Task 4: Wire the Faculty tab into Academic Planning

**Files:**
- Modify: `components/dashboard/management/AcademicPlanningView.tsx:4-7` (imports), `:237` (tabs array), `:353` (render blocks)

**Interfaces:**
- Consumes: `FacultyTab` default export from Task 3.
- Produces: nothing new consumed elsewhere — this is the final integration point.

- [ ] **Step 1: Add the import**

In `components/dashboard/management/AcademicPlanningView.tsx`, current imports (lines 4-7):

```tsx
import SchoolsTab from './SchoolsTab'
import BatchesTab from './BatchesTab'
import SyllabusKanbanBoard from '../SyllabusKanbanBoard'
import { SelectTargetExam } from './SchoolFormHelpers'
```

Change to:

```tsx
import SchoolsTab from './SchoolsTab'
import BatchesTab from './BatchesTab'
import FacultyTab from './FacultyTab'
import SyllabusKanbanBoard from '../SyllabusKanbanBoard'
import { SelectTargetExam } from './SchoolFormHelpers'
```

- [ ] **Step 2: Add the tab entry**

Current (line 237):

```tsx
          {['Schools', 'Programs', 'Batches', 'Syllabus Tracker'].map((tab) => (
```

Change to:

```tsx
          {['Schools', 'Programs', 'Batches', 'Syllabus Tracker', 'Faculty'].map((tab) => (
```

- [ ] **Step 3: Add the render block**

Current (lines 349-353):

```tsx
      {activeTab === 'Syllabus Tracker' && (
        <SyllabusKanbanBoard batches={batchesList.map(b => b.name)} />
      )}

      {activeTab === 'Schools' && <SchoolsTab />}
    </div>
```

Change to:

```tsx
      {activeTab === 'Syllabus Tracker' && (
        <SyllabusKanbanBoard batches={batchesList.map(b => b.name)} />
      )}

      {activeTab === 'Schools' && <SchoolsTab />}

      {activeTab === 'Faculty' && <FacultyTab />}
    </div>
```

- [ ] **Step 4: Verify it builds cleanly**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, sign in as a management user, navigate to Academic Planning. Confirm:
- A "Faculty" tab appears after "Syllabus Tracker".
- Clicking it shows the faculty list (or the empty state if none exist).
- "Import CSV" opens the modal; "Download Sample CSV" downloads a populated template; uploading a file previews rows with red-highlighted cells for missing required fields or unknown batch names; clicking "Import" posts to the bulk endpoint and refreshes the list.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/management/AcademicPlanningView.tsx
git commit -m "feat: wire Faculty tab into Academic Planning"
```

---

## Self-Review

**1. Spec coverage:**
- §1 Data model (no schema changes) → Task 1 uses `faculty`, `teacherBatches`, `batches` as-is. ✅
- §2 API endpoint, all 6 processing steps (required-field check, non-blocking batch validation, 3-tier upsert match with `23505` retry, sparse update, add-only assignment, legacy count sync) → Task 1 implementation. ✅
- §3 Client upload modal (template columns, no default pickers, client-side preview validation, preview table columns, result panel) → Task 2. ✅
- §4 Faculty tab (5th tab, fetches existing `GET` endpoint, table columns, Import CSV button, no edit/delete) → Task 3 + Task 4. ✅
- Testing section's 9 endpoint scenarios → all 9 present in Task 1's test file (plus an empty-array 400 check, matching the reference `students/bulk` test's own extra coverage). ✅
- Testing section's note on `FacultyCsvUploadModal.tsx`'s `rowValidation` — deliberately no test file added, since the reference component (`CsvUploadModal.tsx`) has none either; noted explicitly in Task 2 rather than silently skipped. ✅

**2. Placeholder scan:** No "TBD"/"TODO"/"add error handling" placeholders — every step has complete, runnable code.

**3. Type consistency:** `FieldError.field` values (`'name' | 'subject' | 'specialization' | 'batches' | 'general'`) match between Task 1's server type and Task 2's client-side error shape. The bulk endpoint's request shape (`{ faculty: ParsedRow[] }`) and response shape (`{ succeeded, failed, total, errors }`) match exactly between Task 1's implementation/tests and Task 2's `handleImport`. `FacultyTab`'s consumption of `f.batchAssignments[].batchName` and `f.status` matches the existing `GET /api/teacher-portal/faculty` response shape (confirmed against `app/api/teacher-portal/faculty/route.ts`'s `GET` handler, which returns `batchAssignments` from `teacherBatches` rows with a `batchName` field).
