import { db } from '@/lib/db'
import { tests, questions, students, users, testGrades } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))
jest.mock('@/lib/scheduleUtils', () => ({ getLocalToday: () => '2026-08-15' }))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'
import { GET as GET_QUESTIONS, POST as POST_QUESTIONS } from '../questions/route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('tests/[id]/responses', () => {
  // Scoped-by-ID cleanup only — tests/questions/students/users/test_grades
  // are DB-Guard-protected tables; an unscoped delete silently no-ops and
  // leaks fixtures.
  const createdTestIds: string[] = []
  const createdQuestionIds: string[] = []
  const createdStudentIds: string[] = []
  const createdUserIds: string[] = []

  afterEach(async () => {
    for (const id of createdTestIds) await db.delete(testGrades).where(eq(testGrades.testId, id))
    for (const id of createdTestIds) await db.delete(tests).where(eq(tests.id, id))
    createdTestIds.length = 0
    for (const id of createdQuestionIds) await db.delete(questions).where(eq(questions.id, id))
    createdQuestionIds.length = 0
    for (const id of createdStudentIds) await db.delete(students).where(eq(students.id, id))
    createdStudentIds.length = 0
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
      title: 'TR Route Test', batch: 'TR Route Batch', subject: 'Physics', date: '2026-08-01', totalMarks: 100, createdByUserId: ownerId,
    }).returning()
    createdTestIds.push(t.id)
    return t
  }

  async function createQuestion(ownerId: string) {
    const [q] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Motion', text: 'Q', marks: 4, negativeMarks: 1, createdByUserId: ownerId,
    }).returning()
    createdQuestionIds.push(q.id)
    return q
  }

  async function createStudent() {
    const [s] = await db.insert(students).values({ name: 'TR Route Student', rollNo: '900', batch: 'TR Route Batch', isActive: true }).returning()
    createdStudentIds.push(s.id)
    return s
  }

  it('GET returns the roster with null responses for unattached questions', async () => {
    const owner = await createUser('RRoute Owner', 'teacher')
    const test = await createTest(owner.id)
    const question = await createQuestion(owner.id)
    await createStudent()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await POST_QUESTIONS(req(`http://localhost/api/tests/${test.id}/questions`, {
      method: 'POST', body: JSON.stringify({ questionIds: [question.id] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const res = await GET(req(`http://localhost/api/tests/${test.id}/responses`), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.studentResults).toHaveLength(1)
    expect(body.studentResults[0].responses[question.id]).toBeNull()
  })

  it('POST rejects a response for a question not attached to the test', async () => {
    const owner = await createUser('RRoute Owner Two', 'teacher')
    const test = await createTest(owner.id)
    const question = await createQuestion(owner.id)
    const student = await createStudent()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/responses`, {
      method: 'POST',
      body: JSON.stringify({ responses: [{ studentId: student.id, questionId: question.id, status: 'Correct' }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    expect(res.status).toBe(400)
  })

  it('POST saves attached-question responses, computes averageScore, and marks the test Graded', async () => {
    const owner = await createUser('RRoute Owner Three', 'teacher')
    const test = await createTest(owner.id)
    const q1 = await createQuestion(owner.id)
    const q2 = await createQuestion(owner.id)
    const student = await createStudent()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await POST_QUESTIONS(req(`http://localhost/api/tests/${test.id}/questions`, {
      method: 'POST', body: JSON.stringify({ questionIds: [q1.id, q2.id] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const res = await POST(req(`http://localhost/api/tests/${test.id}/responses`, {
      method: 'POST',
      body: JSON.stringify({ responses: [
        { studentId: student.id, questionId: q1.id, status: 'Correct' },
        { studentId: student.id, questionId: q2.id, status: 'Incorrect' },
      ] }),
    }), { params: Promise.resolve({ id: test.id }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.test.status).toBe('Graded')
    expect(body.test.averageScore).toBe(3)

    const [grade] = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    expect(grade.marksObtained).toBe(3)
  })

  it('POST rejects grading a test scheduled in the future', async () => {
    const owner = await createUser('RRoute Owner Four', 'teacher')
    const [test] = await db.insert(tests).values({
      title: 'Future Response Test', batch: 'TR Route Batch', subject: 'Physics', date: '2099-01-01', totalMarks: 100, createdByUserId: owner.id,
    }).returning()
    createdTestIds.push(test.id)
    const question = await createQuestion(owner.id)
    const student = await createStudent()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    const res = await POST(req(`http://localhost/api/tests/${test.id}/responses`, {
      method: 'POST',
      body: JSON.stringify({ responses: [{ studentId: student.id, questionId: question.id, status: 'Correct' }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    expect(res.status).toBe(409)
  })
})
