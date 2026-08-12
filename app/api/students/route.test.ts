import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, parentsGuardians } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

// Scoped-by-ID cleanup only — never db.delete(students) with no WHERE. The
// DB Guard blocks unscoped deletes on students (returns as if it succeeded,
// but leaves the rows in place), so relying on it here would silently no-op
// and let real rows accumulate across runs.
const createdIds: string[] = []

afterEach(async () => {
  for (const id of createdIds) await db.delete(students).where(eq(students.id, id))
  createdIds.length = 0
  jest.clearAllMocks()
})

describe('GET /api/students', () => {
  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/students'))
    expect(res.status).toBe(401)
  })

  it('returns active students shaped with _id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [active] = await db.insert(students).values({ name: 'Active Kid', class: '11 - A', section: 'A' }).returning()
    createdIds.push(active.id)
    const [inactive] = await db.insert(students).values({ name: 'Inactive Kid', isActive: false }).returning()
    createdIds.push(inactive.id)

    const res = await GET(req('http://localhost/api/students'))
    const body = await res.json()

    expect(res.status).toBe(200)
    const returnedIds = body.map((s: any) => s._id)
    expect(returnedIds).toContain(active.id)
    expect(returnedIds).not.toContain(inactive.id)
    const activeRow = body.find((s: any) => s._id === active.id)
    expect(activeRow.name).toBe('Active Kid')
    expect(activeRow.id).toBeUndefined()
  })

  it('filters by class and section query params', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [match] = await db.insert(students).values({ name: 'Match', class: '10 - B', section: 'B' }).returning()
    createdIds.push(match.id)
    const [noMatch] = await db.insert(students).values({ name: 'No Match', class: '11 - A', section: 'A' }).returning()
    createdIds.push(noMatch.id)

    const res = await GET(req('http://localhost/api/students?class=10 - B&section=B'))
    const body = await res.json()
    const returnedIds = body.map((s: any) => s._id)
    expect(returnedIds).toContain(match.id)
    expect(returnedIds).not.toContain(noMatch.id)
  })
})

describe('POST /api/students', () => {
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
    // Unique-per-run roll number — a fixed value risks colliding with
    // leftover rows from unrelated test runs sharing this class/section.
    const res = await POST(
      req('http://localhost/api/students', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Student', rollNo: `NS-${Date.now()}`, class: '11 - A', section: 'A' }),
      })
    )
    const body = await res.json()
    if (res.status === 201) createdIds.push(body._id)
    expect(res.status).toBe(201)
    expect(body.name).toBe('New Student')
    expect(typeof body._id).toBe('string')
  })

  it('returns 409 on a duplicate rollNo+class+section', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const payload = { name: 'Dup', rollNo: `DUP-${Date.now()}`, class: '11 - A', section: 'A' }
    const first = await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify(payload) }))
    const firstBody = await first.json()
    expect(first.status).toBe(201)
    createdIds.push(firstBody._id)
    const res = await POST(req('http://localhost/api/students', { method: 'POST', body: JSON.stringify(payload) }))
    expect(res.status).toBe(409)
  })

  it('accepts and persists program and batch on create', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/students', {
        method: 'POST',
        body: JSON.stringify({ name: 'Prog Student', program: 'JEE 2026', batch: 'Morning' }),
      })
    )
    const body = await res.json()
    if (res.status === 201) createdIds.push(body._id)
    expect(res.status).toBe(201)
    expect(body.program).toBe('JEE 2026')
    expect(body.batch).toBe('Morning')
  })

  it('rejects a phone number longer than 10 characters', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/students', { method: 'POST', body: JSON.stringify({ name: 'X', phone: '1234567890187' }) })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/10 characters/)
  })

  it('rejects a parent contact number longer than 10 characters', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/students', { method: 'POST', body: JSON.stringify({ name: 'X', parentContact: '9876543210323' }) })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/10 characters/)
  })
})

describe('PATCH /api/students', () => {
  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await PATCH(req('http://localhost/api/students?id=x', { method: 'PATCH', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('updates a student by id', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'Before' }).returning()
    createdIds.push(created.id)

    const res = await PATCH(
      req(`http://localhost/api/students?id=${created.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'After' }) })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.name).toBe('After')
    expect(body._id).toBe(created.id)
  })

  it('updates program and batch', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'Before' }).returning()
    createdIds.push(created.id)

    const res = await PATCH(
      req(`http://localhost/api/students?id=${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ program: 'Foundation', batch: 'Evening' }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.program).toBe('Foundation')
    expect(body.batch).toBe('Evening')
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

  it('rejects updating phone to a value longer than 10 characters', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'Before' }).returning()
    createdIds.push(created.id)

    const res = await PATCH(
      req(`http://localhost/api/students?id=${created.id}`, { method: 'PATCH', body: JSON.stringify({ phone: '1234567890187' }) })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/10 characters/)
  })
})

describe('DELETE /api/students', () => {
  it('permanently deletes the student, even without a permanent param', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()
    createdIds.push(created.id)

    const res = await DELETE(req(`http://localhost/api/students?id=${created.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)

    const rows = await db.select().from(students).where(eq(students.id, created.id))
    expect(rows).toHaveLength(0)
  })

  it('cascades the delete to the student\'s guardians', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [created] = await db.insert(students).values({ name: 'To Remove' }).returning()
    createdIds.push(created.id)
    await db.insert(parentsGuardians).values({ studentId: created.id, name: 'ABC', isPrimary: true })

    await DELETE(req(`http://localhost/api/students?id=${created.id}`, { method: 'DELETE' }))

    const guardianRows = await db.select().from(parentsGuardians).where(eq(parentsGuardians.studentId, created.id))
    expect(guardianRows).toHaveLength(0)
  })
})
