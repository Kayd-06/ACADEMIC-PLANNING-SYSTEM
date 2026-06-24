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
