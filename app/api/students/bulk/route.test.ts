import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, parentsGuardians } from '@/lib/db/schema'

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

  it('skips rows with no name and reports the total of valid rows', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: '' }, { name: 'Valid' }] }))
    const body = await res.json()
    expect(body.total).toBe(1)
  })

  it('uses the global default program/batch/section when provided, overriding row values', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req({
        students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }],
        defaults: { program: 'Default Program', batch: 'Default Batch', section: 'Default Section' },
      })
    )
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('Default Program')
    expect(rows[0].batch).toBe('Default Batch')
    expect(rows[0].section).toBe('Default Section')
  })

  it('falls back to the row CSV value when no default is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req({ students: [{ name: 'A', program: 'Row Program', batch: 'Row Batch', section: 'Row Section' }] })
    )
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('Row Program')
    expect(rows[0].batch).toBe('Row Batch')
    expect(rows[0].section).toBe('Row Section')
  })

  it('leaves program and batch empty when neither a default nor a row value is provided', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req({ students: [{ name: 'A' }] }))
    expect(res.status).toBe(201)

    const rows = await db.select().from(students)
    expect(rows[0].program).toBe('')
    expect(rows[0].batch).toBe('')
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
