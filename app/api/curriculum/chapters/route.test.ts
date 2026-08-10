import { db } from '@/lib/db'
import { chapters, subjects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

const createdIds = { chapters: [] as string[], subjects: [] as string[] }

afterEach(async () => {
  for (const id of createdIds.chapters) await db.delete(chapters).where(eq(chapters.id, id))
  for (const id of createdIds.subjects) await db.delete(subjects).where(eq(subjects.id, id))
  createdIds.chapters.length = 0
  createdIds.subjects.length = 0
  jest.clearAllMocks()
})

describe('GET /api/curriculum/chapters', () => {
  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/curriculum/chapters?subjectId=x'))
    expect(res.status).toBe(401)
  })

  it('requires subjectId', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/curriculum/chapters'))
    expect(res.status).toBe(400)
  })

  it('lists chapters for the given subject, ordered by orderIndex', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const [subject] = await db.insert(subjects).values({ name: 'Physics' }).returning()
    createdIds.subjects.push(subject.id)
    const [second] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Thermodynamics', orderIndex: 2 }).returning()
    const [first] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Kinematics', orderIndex: 1 }).returning()
    createdIds.chapters.push(second.id, first.id)

    const res = await GET(req(`http://localhost/api/curriculum/chapters?subjectId=${subject.id}`))
    const body = await res.json()
    expect(body.map((c: any) => c.name)).toEqual(['Kinematics', 'Thermodynamics'])
  })
})

describe('POST /api/curriculum/chapters', () => {
  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/curriculum/chapters', { method: 'POST', body: JSON.stringify({ name: 'X' }) }))
    expect(res.status).toBe(403)
  })

  it('creates a chapter with code and board', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    createdIds.subjects.push(subject.id)

    const res = await POST(req('http://localhost/api/curriculum/chapters', {
      method: 'POST',
      body: JSON.stringify({ subjectId: subject.id, name: 'Chemical Bonding', code: 'CHM-04', board: 'CBSE' }),
    }))
    const body = await res.json()
    if (res.status === 201) createdIds.chapters.push(body.id)
    expect(res.status).toBe(201)
    expect(body.code).toBe('CHM-04')
    expect(body.board).toBe('CBSE')
  })
})

describe('PATCH /api/curriculum/chapters', () => {
  it('updates chapter fields', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'Biology' }).returning()
    createdIds.subjects.push(subject.id)
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Cell Biology' }).returning()
    createdIds.chapters.push(chapter.id)

    const res = await PATCH(req(`http://localhost/api/curriculum/chapters?id=${chapter.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ code: 'BIO-01' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.code).toBe('BIO-01')
  })
})

describe('DELETE /api/curriculum/chapters', () => {
  it('removes the chapter', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'Maths' }).returning()
    createdIds.subjects.push(subject.id)
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Calculus' }).returning()

    const res = await DELETE(req(`http://localhost/api/curriculum/chapters?id=${chapter.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)

    const rows = await db.select().from(chapters).where(eq(chapters.id, chapter.id))
    expect(rows).toHaveLength(0)
  })
})
