import { db } from '@/lib/db'
import { chapters, concepts, subjects, schools, programs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

const createdIds = { concepts: [] as string[], chapters: [] as string[], subjects: [] as string[], schools: [] as string[], programs: [] as string[] }

afterEach(async () => {
  for (const id of createdIds.concepts) await db.delete(concepts).where(eq(concepts.id, id))
  for (const id of createdIds.chapters) await db.delete(chapters).where(eq(chapters.id, id))
  for (const id of createdIds.subjects) await db.delete(subjects).where(eq(subjects.id, id))
  for (const id of createdIds.programs) await db.delete(programs).where(eq(programs.id, id))
  for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
  createdIds.concepts.length = 0
  createdIds.chapters.length = 0
  createdIds.subjects.length = 0
  createdIds.programs.length = 0
  createdIds.schools.length = 0
  jest.clearAllMocks()
})

describe('POST /api/curriculum/bulk-import', () => {
  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(req('http://localhost/api/curriculum/bulk-import', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(401)
  })

  it('rejects when role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/curriculum/bulk-import', { method: 'POST', body: JSON.stringify({ subjectId: 'x', rows: [{ chapterName: 'X' }] }) }))
    expect(res.status).toBe(403)
  })

  it('requires subjectId', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(req('http://localhost/api/curriculum/bulk-import', { method: 'POST', body: JSON.stringify({ rows: [{ chapterName: 'X' }] }) }))
    expect(res.status).toBe(400)
  })

  it('groups multiple concept rows under one chapter, creating both', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'BI Physics Combined' }).returning()
    createdIds.subjects.push(subject.id)

    const res = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: subject.id,
        rows: [
          { chapterName: 'Laws of Motion', chapterCode: 'PHY-CH3', board: 'CBSE', expectedHours: '12', conceptName: "Newton's First Law", conceptCode: 'C1' },
          { chapterName: 'Laws of Motion', conceptName: "Newton's Second Law", conceptCode: 'C2' },
          { chapterName: 'Optics', conceptName: 'Refraction' },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.chapters).toEqual({ succeeded: 2, failed: 0, total: 2 })
    expect(body.concepts).toEqual({ succeeded: 3, failed: 0, total: 3 })
    expect(body.errors).toHaveLength(0)

    const chapterRows = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    createdIds.chapters.push(...chapterRows.map((c) => c.id))
    expect(chapterRows).toHaveLength(2)
    const lawsOfMotion = chapterRows.find((c) => c.name === 'Laws of Motion')!
    expect(lawsOfMotion.code).toBe('PHY-CH3')
    expect(lawsOfMotion.board).toBe('CBSE')
    expect(lawsOfMotion.expectedHours).toBe(12)

    const conceptRows = await db.select().from(concepts).where(eq(concepts.chapterId, lawsOfMotion.id))
    createdIds.concepts.push(...conceptRows.map((c) => c.id))
    expect(conceptRows.map((c) => c.name).sort()).toEqual(["Newton's First Law", "Newton's Second Law"])

    const optics = chapterRows.find((c) => c.name === 'Optics')!
    const opticsConcepts = await db.select().from(concepts).where(eq(concepts.chapterId, optics.id))
    createdIds.concepts.push(...opticsConcepts.map((c) => c.id))
    expect(opticsConcepts).toHaveLength(1)
  })

  it('supports a chapter-only row with no concept', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'BI Chapter Only' }).returning()
    createdIds.subjects.push(subject.id)

    const res = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ subjectId: subject.id, rows: [{ chapterName: 'Thermodynamics' }] }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.chapters).toEqual({ succeeded: 1, failed: 0, total: 1 })
    expect(body.concepts).toEqual({ succeeded: 0, failed: 0, total: 0 })

    const rows = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    createdIds.chapters.push(...rows.map((c) => c.id))
    expect(rows).toHaveLength(1)
  })

  it('flags rows missing a chapter name and re-import updates instead of duplicating', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [subject] = await db.insert(subjects).values({ name: 'BI Reimport' }).returning()
    createdIds.subjects.push(subject.id)

    const first = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: subject.id,
        rows: [
          { chapterName: '', conceptName: 'Orphan' },
          { chapterName: 'Organic Chemistry', conceptCode: 'OLD', conceptName: 'Isomerism' },
        ],
      }),
    }))
    const firstBody = await first.json()
    expect(firstBody.chapters).toEqual({ succeeded: 1, failed: 0, total: 1 })
    expect(firstBody.errors.some((e: any) => e.level === 'chapter' && e.message === 'Chapter Name is required')).toBe(true)

    const chapterRows = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    createdIds.chapters.push(...chapterRows.map((c) => c.id))
    expect(chapterRows).toHaveLength(1)

    const second = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ subjectId: subject.id, rows: [{ chapterName: 'organic chemistry', conceptName: 'isomerism', conceptCode: 'NEW' }] }),
    }))
    const secondBody = await second.json()
    expect(second.status).toBe(201)
    expect(secondBody.chapters).toEqual({ succeeded: 1, failed: 0, total: 1 })
    expect(secondBody.concepts).toEqual({ succeeded: 1, failed: 0, total: 1 })

    const chapterRowsAfter = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    expect(chapterRowsAfter).toHaveLength(1)
    const conceptRows = await db.select().from(concepts).where(eq(concepts.chapterId, chapterRowsAfter[0].id))
    createdIds.concepts.push(...conceptRows.map((c) => c.id))
    expect(conceptRows).toHaveLength(1)
    expect(conceptRows[0].code).toBe('NEW')
  })

  it('links a chapter to a program by name (scoped to the caller school) and sets classLevel', async () => {
    const [school] = await db.insert(schools).values({ name: 'BI Program School' }).returning()
    createdIds.schools.push(school.id)
    const [program] = await db.insert(programs).values({ name: 'JEE Advanced', schoolId: school.id }).returning()
    createdIds.programs.push(program.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const [subject] = await db.insert(subjects).values({ name: 'BI Program Physics', schoolId: school.id }).returning()
    createdIds.subjects.push(subject.id)

    const res = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: subject.id,
        rows: [{ chapterName: 'Kinematics', classLevel: '11', program: 'jee advanced', conceptName: 'Projectile Motion' }],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.errors).toHaveLength(0)

    const [chapter] = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    createdIds.chapters.push(chapter.id)
    const conceptRows = await db.select().from(concepts).where(eq(concepts.chapterId, chapter.id))
    createdIds.concepts.push(...conceptRows.map((c) => c.id))
    expect(chapter.classLevel).toBe('11')
    expect(chapter.programId).toBe(program.id)
  })

  it('fails the chapter when the named program does not exist for that school', async () => {
    const [school] = await db.insert(schools).values({ name: 'BI No Program School' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const [subject] = await db.insert(subjects).values({ name: 'BI No Program Physics', schoolId: school.id }).returning()
    createdIds.subjects.push(subject.id)

    const res = await POST(req('http://localhost/api/curriculum/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ subjectId: subject.id, rows: [{ chapterName: 'Optics', program: 'Nonexistent Program' }] }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.chapters).toEqual({ succeeded: 0, failed: 1, total: 1 })
    expect(body.errors[0].message).toMatch(/Program "Nonexistent Program" was not found/)

    const rows = await db.select().from(chapters).where(eq(chapters.subjectId, subject.id))
    expect(rows).toHaveLength(0)
  })
})
