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
