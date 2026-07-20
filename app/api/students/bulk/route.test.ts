import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, parentsGuardians, programs, batches, schools } from '@/lib/db/schema'

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
    expect(body).toEqual({ succeeded: 2, failed: 0, total: 2, errors: [] })

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

  it('upserts the primary guardian instead of duplicating it on repeat import', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    // Unique-per-run roll number — the file's own afterEach uses an unscoped
    // db.delete(students), which the DB Guard silently blocks, so leftover
    // rows from prior runs persist. Use a fresh rollNo each run and clean up
    // this test's own row by ID in the finally block below.
    const rollNo = `GT-${Date.now()}`
    const row = {
      name: 'Guardian Test', rollNo, class: '11 - A', section: 'A',
      guardianName: 'ABC', guardianPhone: '9876543210', guardianEmail: 'suresh.sharma@example.com',
    }
    try {
      await POST(req({ students: [row] }))
      await POST(req({ students: [{ ...row, guardianPhone: '9998887770' }] }))

      const [student] = await db.select().from(students).where(eq(students.rollNo, rollNo))
      const guardianRows = await db.select().from(parentsGuardians).where(eq(parentsGuardians.studentId, student.id))
      expect(guardianRows).toHaveLength(1)
      expect(guardianRows[0].phone).toBe('9998887770')
    } finally {
      const [student] = await db.select().from(students).where(eq(students.rollNo, rollNo))
      if (student) await db.delete(students).where(eq(students.id, student.id))
    }
  })

  it('upserts by admission number when rollNo/class/section are incomplete', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const admissionNumber = `ADM-${Date.now()}`
    const row = { name: 'Admission Match', admissionNumber }
    try {
      await POST(req({ students: [row] }))
      await POST(req({ students: [{ ...row, name: 'Admission Match Updated' }] }))

      const rows = await db.select().from(students).where(eq(students.admissionNumber, admissionNumber))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('Admission Match Updated')
    } finally {
      const rows = await db.select().from(students).where(eq(students.admissionNumber, admissionNumber))
      for (const r of rows) await db.delete(students).where(eq(students.id, r.id))
    }
  })

  it('upserts by name+class+section when no rollNo or admission number is present', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const name = `Name Match ${Date.now()}`
    const row = { name, class: '9 - B', section: 'B' }
    try {
      await POST(req({ students: [row] }))
      await POST(req({ students: [{ ...row, phone: '9998887770' }] }))

      const rows = await db.select().from(students).where(eq(students.name, name))
      expect(rows).toHaveLength(1)
      expect(rows[0].phone).toBe('9998887770')
    } finally {
      const rows = await db.select().from(students).where(eq(students.name, name))
      for (const r of rows) await db.delete(students).where(eq(students.id, r.id))
    }
  })

  it('skips rows with no name and reports the total of valid rows', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: '' }, { name: 'Valid' }] }))
    const body = await res.json()
    expect(body.total).toBe(1)
  })

  it('uses the global default program/batch/section when provided, overriding row values', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const name = `Default Applied ${Date.now()}`
    const [program] = await db.insert(programs).values({ name: 'Default Program' }).returning()
    const [batch] = await db.insert(batches).values({ name: 'Default Batch', programId: program.id }).returning()
    try {
      const res = await POST(
        req({
          students: [{ name, program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }],
          defaults: { program: 'Default Program', batch: 'Default Batch', section: 'Default Section' },
        })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.succeeded).toBe(1)

      const rows = await db.select().from(students).where(eq(students.name, name))
      expect(rows[0].program).toBe('Default Program')
      expect(rows[0].batch).toBe('Default Batch')
      expect(rows[0].section).toBe('Default Section')
    } finally {
      const rows = await db.select().from(students).where(eq(students.name, name))
      for (const r of rows) await db.delete(students).where(eq(students.id, r.id))
      await db.delete(batches).where(eq(batches.id, batch.id))
      await db.delete(programs).where(eq(programs.id, program.id))
    }
  })

  it('falls back to the row CSV value when no default is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const name = `Row Fallback ${Date.now()}`
    const [program] = await db.insert(programs).values({ name: 'Row Program' }).returning()
    const [batch] = await db.insert(batches).values({ name: 'Row Batch', programId: program.id }).returning()
    try {
      const res = await POST(
        req({ students: [{ name, program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }] })
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.succeeded).toBe(1)

      const rows = await db.select().from(students).where(eq(students.name, name))
      expect(rows[0].program).toBe('Row Program')
      expect(rows[0].batch).toBe('Row Batch')
      expect(rows[0].section).toBe('Row Section')
    } finally {
      const rows = await db.select().from(students).where(eq(students.name, name))
      for (const r of rows) await db.delete(students).where(eq(students.id, r.id))
      await db.delete(batches).where(eq(batches.id, batch.id))
      await db.delete(programs).where(eq(programs.id, program.id))
    }
  })

  it('leaves program and batch empty when neither a default nor a row value is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'A' }] }))
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('')
    expect(rows[0].batch).toBe('')
  })

  it('skips a row whose Program does not exist and reports a field error', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'Ghost Program', program: 'Nonexistent Program' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.succeeded).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors).toEqual([
      { row: 'Ghost Program', field: 'program', value: 'Nonexistent Program', message: expect.stringContaining('does not exist') },
    ])

    const rows = await db.select().from(students).where(eq(students.name, 'Ghost Program'))
    expect(rows).toHaveLength(0)
  })

  it('skips a row whose Batch does not exist and reports a field error', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'Ghost Batch', batch: 'Nonexistent Batch' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.succeeded).toBe(0)
    expect(body.failed).toBe(1)
    expect(body.errors[0].field).toBe('batch')
    expect(body.errors[0].value).toBe('Nonexistent Batch')

    const rows = await db.select().from(students).where(eq(students.name, 'Ghost Batch'))
    expect(rows).toHaveLength(0)
  })

  it('skips a row whose Batch belongs to a different Program than the one given', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [programA] = await db.insert(programs).values({ name: 'Program A' }).returning()
    const [programB] = await db.insert(programs).values({ name: 'Program B' }).returning()
    const [batchOfA] = await db.insert(batches).values({ name: 'Batch Of A', programId: programA.id }).returning()
    try {
      const res = await POST(req({ students: [{ name: 'Mismatch', program: 'Program B', batch: 'Batch Of A' }] }))
      const body = await res.json()
      expect(body.succeeded).toBe(0)
      expect(body.failed).toBe(1)
      expect(body.errors[0].field).toBe('batch')
      expect(body.errors[0].message).toContain('different Program')
    } finally {
      await db.delete(batches).where(eq(batches.id, batchOfA.id))
      await db.delete(programs).where(eq(programs.id, programA.id))
      await db.delete(programs).where(eq(programs.id, programB.id))
    }
  })

  it('imports valid rows and skips only the invalid ones in the same request', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const name = `Valid Row ${Date.now()}`
    try {
      const res = await POST(req({
        students: [
          { name },
          { name: 'Invalid Row', program: 'Totally Made Up Program' },
        ],
      }))
      const body = await res.json()
      expect(body.succeeded).toBe(1)
      expect(body.failed).toBe(1)
      expect(body.total).toBe(2)

      const rows = await db.select().from(students).where(eq(students.name, name))
      expect(rows).toHaveLength(1)
    } finally {
      const rows = await db.select().from(students).where(eq(students.name, name))
      for (const r of rows) await db.delete(students).where(eq(students.id, r.id))
    }
  })

  it('scopes Program/Batch validation by schoolId', async () => {
    const schoolId = '11111111-1111-1111-1111-111111111111'
    const otherSchoolId = '22222222-2222-2222-2222-222222222222'
    await db.insert(schools).values({ id: schoolId as any })
    await db.insert(schools).values({ id: otherSchoolId as any })
    const [otherSchoolProgram] = await db.insert(programs).values({ name: 'Other School Program', schoolId: otherSchoolId as any }).returning()
    try {
      ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId } })
      const res = await POST(req({ students: [{ name: 'Cross School', program: 'Other School Program' }] }))
      const body = await res.json()
      expect(body.succeeded).toBe(0)
      expect(body.failed).toBe(1)
      expect(body.errors[0].field).toBe('program')
    } finally {
      await db.delete(programs).where(eq(programs.id, otherSchoolProgram.id))
      await db.delete(schools).where(eq(schools.id, schoolId as any))
      await db.delete(schools).where(eq(schools.id, otherSchoolId as any))
    }
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
