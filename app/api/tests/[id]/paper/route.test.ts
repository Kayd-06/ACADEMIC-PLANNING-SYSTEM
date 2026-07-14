import { db } from '@/lib/db'
import { tests, users, schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

const mockPut = jest.fn()
const mockGet = jest.fn()
jest.mock('@vercel/blob', () => ({
  put: (...args: any[]) => mockPut(...args),
  get: (...args: any[]) => mockGet(...args),
}))

import { auth } from '@/lib/auth'
import { GET, POST, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function createUser(name: string, role: 'teacher' | 'management') {
  const [u] = await db.insert(users).values({
    name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
    password: 'x', role,
  }).returning()
  return u
}

describe('tests/[id]/paper', () => {
  afterEach(async () => {
    await db.delete(tests)
    await db.delete(users)
    await db.delete(schools)
    jest.clearAllMocks()
  })

  it('POST rejects a teacher who does not own the test', async () => {
    const owner = await createUser('Paper Owner', 'teacher')
    const outsider = await createUser('Paper Outsider', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: owner.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: outsider.id, role: 'teacher', schoolId: null } })
    const formData = new FormData()
    formData.append('file', new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' }))
    const res = await POST(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'POST', body: formData }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it('POST attaches the paper for the owning teacher', async () => {
    const owner = await createUser('Paper Owner Two', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Two', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: owner.id,
    }).returning()

    mockPut.mockResolvedValue({ url: 'https://example.blob.vercel-storage.com/test-papers/abc.pdf' })
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const formData = new FormData()
    formData.append('file', new File(['%PDF-1.4'], 'my-paper.pdf', { type: 'application/pdf' }))
    const res = await POST(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'POST', body: formData }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.paperFileName).toBe('my-paper.pdf')

    const [updated] = await db.select().from(tests).where(eq(tests.id, test.id))
    expect(updated.paperUrl).toBe('https://example.blob.vercel-storage.com/test-papers/abc.pdf')
  })

  it('GET rejects a management user from a different school', async () => {
    // tests.schoolId is FK-constrained against a real schools row, so the
    // two school ids used below must actually exist (same pattern as
    // lib/db/queries/students.test.ts).
    await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000a1' as any })
    await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000b1' as any })

    const owner = await createUser('Paper Owner Three', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Three', batch: 'Batch A', subject: 'Physics', date: '2026-08-01',
      createdByUserId: owner.id, paperUrl: 'https://example.blob.vercel-storage.com/x.pdf',
      schoolId: '00000000-0000-0000-0000-0000000000a1' as any,
    }).returning()

    const manager = await createUser('Other School Manager', 'management')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: '00000000-0000-0000-0000-0000000000b1' } })
    const res = await GET(req(`http://localhost/api/tests/${test.id}/paper`), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('DELETE clears the paper reference for the owning teacher', async () => {
    const owner = await createUser('Paper Owner Four', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Paper Test Four', batch: 'Batch A', subject: 'Physics', date: '2026-08-01',
      createdByUserId: owner.id, paperUrl: 'https://example.blob.vercel-storage.com/x.pdf', paperFileName: 'x.pdf',
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/${test.id}/paper`, { method: 'DELETE' }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(200)

    const [updated] = await db.select().from(tests).where(eq(tests.id, test.id))
    expect(updated.paperUrl).toBeNull()
    expect(updated.paperFileName).toBeNull()
  })
})
