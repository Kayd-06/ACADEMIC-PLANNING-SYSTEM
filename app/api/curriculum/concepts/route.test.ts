import { db } from '@/lib/db'
import { concepts, chapters, subjects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

const createdIds = { concepts: [] as string[], chapters: [] as string[], subjects: [] as string[] }

afterEach(async () => {
  for (const id of createdIds.concepts) await db.delete(concepts).where(eq(concepts.id, id))
  for (const id of createdIds.chapters) await db.delete(chapters).where(eq(chapters.id, id))
  for (const id of createdIds.subjects) await db.delete(subjects).where(eq(subjects.id, id))
  createdIds.concepts.length = 0
  createdIds.chapters.length = 0
  createdIds.subjects.length = 0
  jest.clearAllMocks()
})

async function makeChapter() {
  const [subject] = await db.insert(subjects).values({ name: 'Physics' }).returning()
  createdIds.subjects.push(subject.id)
  const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Kinematics' }).returning()
  createdIds.chapters.push(chapter.id)
  return chapter
}

describe('GET /api/curriculum/concepts', () => {
  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/curriculum/concepts?chapterId=x'))
    expect(res.status).toBe(401)
  })

  it('requires chapterId', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/curriculum/concepts'))
    expect(res.status).toBe(400)
  })

  it('lists concepts for the given chapter, ordered by orderIndex', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const chapter = await makeChapter()
    const [second] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Circular Motion', orderIndex: 2 }).returning()
    const [first] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Vectors', orderIndex: 1 }).returning()
    createdIds.concepts.push(second.id, first.id)

    const res = await GET(req(`http://localhost/api/curriculum/concepts?chapterId=${chapter.id}`))
    const body = await res.json()
    expect(body.map((c: any) => c.name)).toEqual(['Vectors', 'Circular Motion'])
  })
})

describe('POST /api/curriculum/concepts', () => {
  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/curriculum/concepts', { method: 'POST', body: JSON.stringify({ name: 'X' }) }))
    expect(res.status).toBe(403)
  })

  it('creates a concept linked to a chapter', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const chapter = await makeChapter()

    const res = await POST(req('http://localhost/api/curriculum/concepts', {
      method: 'POST',
      body: JSON.stringify({ chapterId: chapter.id, name: 'Relative Velocity', code: 'KIN-02' }),
    }))
    const body = await res.json()
    if (res.status === 201) createdIds.concepts.push(body.id)
    expect(res.status).toBe(201)
    expect(body.chapterId).toBe(chapter.id)
    expect(body.code).toBe('KIN-02')
  })
})

describe('PATCH /api/curriculum/concepts', () => {
  it('updates concept fields', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const chapter = await makeChapter()
    const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Free Fall' }).returning()
    createdIds.concepts.push(concept.id)

    const res = await PATCH(req(`http://localhost/api/curriculum/concepts?id=${concept.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ code: 'KIN-03' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.code).toBe('KIN-03')
  })
})

describe('DELETE /api/curriculum/concepts', () => {
  it('removes the concept', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const chapter = await makeChapter()
    const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Projectile Motion' }).returning()

    const res = await DELETE(req(`http://localhost/api/curriculum/concepts?id=${concept.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(200)

    const rows = await db.select().from(concepts).where(eq(concepts.id, concept.id))
    expect(rows).toHaveLength(0)
  })
})
