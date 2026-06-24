import { eq } from 'drizzle-orm'
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
