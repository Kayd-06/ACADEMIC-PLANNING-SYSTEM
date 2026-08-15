import { db } from '@/lib/db'
import { tests, questions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('tests/[id]/questions', () => {
  // Scoped-by-ID cleanup only — tests/questions/users are DB-Guard-protected
  // tables; an unscoped delete silently no-ops and leaks fixtures.
  const createdTestIds: string[] = []
  const createdQuestionIds: string[] = []
  const createdUserIds: string[] = []

  afterEach(async () => {
    for (const id of createdTestIds) await db.delete(tests).where(eq(tests.id, id))
    createdTestIds.length = 0
    for (const id of createdQuestionIds) await db.delete(questions).where(eq(questions.id, id))
    createdQuestionIds.length = 0
    for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id))
    createdUserIds.length = 0
    jest.clearAllMocks()
  })

  async function createUser(name: string, role: 'teacher' | 'management') {
    const [u] = await db.insert(users).values({
      name, email: `${name.toLowerCase().replace(/\s+/g, '')}-${Date.now()}@example.com`,
      password: 'x', role,
    }).returning()
    createdUserIds.push(u.id)
    return u
  }

  async function createTest(ownerId: string) {
    const [t] = await db.insert(tests).values({
      title: 'TQ Route Test', batch: 'TQ Route Batch', subject: 'Physics', date: '2026-08-01', createdByUserId: ownerId,
    }).returning()
    createdTestIds.push(t.id)
    return t
  }

  async function createQuestion(ownerId: string, text: string) {
    const [q] = await db.insert(questions).values({ subject: 'Physics', topic: 'Motion', text, createdByUserId: ownerId }).returning()
    createdQuestionIds.push(q.id)
    return q
  }

  it('GET returns an empty list for a test with no attached questions', async () => {
    const owner = await createUser('QRoute Owner', 'teacher')
    const test = await createTest(owner.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })

    const res = await GET(req(`http://localhost/api/tests/${test.id}/questions`), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('GET rejects a teacher who does not own the test', async () => {
    const owner = await createUser('QRoute Owner Two', 'teacher')
    const outsider = await createUser('QRoute Outsider', 'teacher')
    const test = await createTest(owner.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: outsider.id, role: 'teacher', schoolId: null } })

    const res = await GET(req(`http://localhost/api/tests/${test.id}/questions`), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(404)
  })

  it('POST attaches only the caller\'s own questions, dropping IDs owned by another teacher', async () => {
    const owner = await createUser('QRoute Owner Three', 'teacher')
    const other = await createUser('QRoute Other', 'teacher')
    const test = await createTest(owner.id)
    const ownQuestion = await createQuestion(owner.id, 'Own Question')
    const otherQuestion = await createQuestion(other.id, 'Other Question')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/questions`, {
      method: 'POST',
      body: JSON.stringify({ questionIds: [ownQuestion.id, otherQuestion.id] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.map((q: any) => q.id)).toEqual([ownQuestion.id])
  })

  it('POST replaces the previous question set', async () => {
    const owner = await createUser('QRoute Owner Four', 'teacher')
    const test = await createTest(owner.id)
    const q1 = await createQuestion(owner.id, 'First')
    const q2 = await createQuestion(owner.id, 'Second')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await POST(req(`http://localhost/api/tests/${test.id}/questions`, {
      method: 'POST', body: JSON.stringify({ questionIds: [q1.id] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/questions`, {
      method: 'POST', body: JSON.stringify({ questionIds: [q2.id] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()

    expect(body.map((q: any) => q.id)).toEqual([q2.id])
  })
})
