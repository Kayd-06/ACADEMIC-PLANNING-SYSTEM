import { db } from '@/lib/db'
import { questions, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

import { auth } from '@/lib/auth'
import { GET, POST, PUT, DELETE } from './route'

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

describe('tests/questions ownership', () => {
  afterEach(async () => {
    await db.delete(questions)
    await db.delete(users)
    jest.clearAllMocks()
  })

  it('POST stamps createdByUserId with the creating teacher', async () => {
    const teacher = await createUser('Q Teacher One', 'teacher')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'teacher', schoolId: null } })

    const res = await POST(req('http://localhost/api/tests/questions', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Physics', topic: 'Motion', difficulty: 'Easy', type: 'MCQ', text: 'What is velocity?' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.createdByUserId).toBe(teacher.id)
  })

  it('GET for a teacher only returns their own questions', async () => {
    const teacherA = await createUser('Q Teacher A', 'teacher')
    const teacherB = await createUser('Q Teacher B', 'teacher')
    await db.insert(questions).values([
      { subject: 'Physics', topic: 'A', text: 'A Question', createdByUserId: teacherA.id },
      { subject: 'Physics', topic: 'B', text: 'B Question', createdByUserId: teacherB.id },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/questions'))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].text).toBe('A Question')
  })

  it('GET for management returns every question in the school, including legacy owner-less rows', async () => {
    const teacher = await createUser('Q Teacher C', 'teacher')
    const manager = await createUser('Q Manager A', 'management')
    await db.insert(questions).values([
      { subject: 'Physics', topic: 'Owned', text: 'Owned Question', createdByUserId: teacher.id },
      { subject: 'Physics', topic: 'Legacy', text: 'Legacy Question', createdByUserId: null },
    ])

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: manager.id, role: 'management', schoolId: null } })
    const res = await GET(req('http://localhost/api/tests/questions'))
    const body = await res.json()
    expect(body.map((q: any) => q.text).sort()).toEqual(['Legacy Question', 'Owned Question'])
  })

  it('DELETE returns 404 when a teacher targets a question they do not own', async () => {
    const teacherA = await createUser('Q Teacher D', 'teacher')
    const teacherB = await createUser('Q Teacher E', 'teacher')
    const [otherQuestion] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Not Mine', text: 'Not Mine Question', createdByUserId: teacherB.id,
    }).returning()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacherA.id, role: 'teacher', schoolId: null } })
    const res = await DELETE(req(`http://localhost/api/tests/questions?id=${otherQuestion.id}`, { method: 'DELETE' }))
    expect(res.status).toBe(404)

    const stillThere = await db.select().from(questions).where(eq(questions.id, otherQuestion.id))
    expect(stillThere).toHaveLength(1)
  })
})
