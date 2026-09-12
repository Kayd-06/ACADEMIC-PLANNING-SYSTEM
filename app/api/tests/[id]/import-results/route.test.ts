import { db } from '@/lib/db'
import { tests, questions, students, users, testQuestionResponses, testGrades, dailyStudentRatings, ptmReports } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))

import { auth } from '@/lib/auth'
import { POST } from './route'
// Questions are attached to a test the same way the rest of the codebase's
// own tests do it (see app/api/tests/[id]/responses/route.test.ts) — via the
// real POST /api/tests/[id]/questions handler, which calls setQuestionsForTest
// internally. There is no direct raw insert into a testQuestions table
// anywhere else in the test suite, so this route's tests follow suit rather
// than assuming an unverified schema shape.
import { POST as POST_QUESTIONS } from '../questions/route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('POST /api/tests/[id]/import-results', () => {
  // Scoped-by-ID cleanup only, same convention as responses/route.test.ts —
  // testQuestions rows are not deleted explicitly; they clean up as part of
  // that same established pattern.
  const createdTestIds: string[] = []
  const createdQuestionIds: string[] = []
  const createdStudentIds: string[] = []
  const createdUserIds: string[] = []

  afterEach(async () => {
    for (const id of createdTestIds) {
      await db.delete(testQuestionResponses).where(eq(testQuestionResponses.testId, id))
      await db.delete(testGrades).where(eq(testGrades.testId, id))
    }
    for (const id of createdStudentIds) {
      await db.delete(dailyStudentRatings).where(eq(dailyStudentRatings.studentId, id))
      await db.delete(ptmReports).where(eq(ptmReports.studentId, id))
    }
    for (const id of createdTestIds) await db.delete(tests).where(eq(tests.id, id))
    createdTestIds.length = 0
    for (const id of createdQuestionIds) await db.delete(questions).where(eq(questions.id, id))
    createdQuestionIds.length = 0
    for (const id of createdStudentIds) await db.delete(students).where(eq(students.id, id))
    createdStudentIds.length = 0
    for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id))
    createdUserIds.length = 0
  })

  async function createUser(name: string, role: 'teacher' | 'management') {
    const [u] = await db.insert(users).values({ name, email: `${name.replace(/\s+/g, '')}-${Date.now()}@example.com`, password: 'x', role }).returning()
    createdUserIds.push(u.id)
    return u
  }

  async function createTest(ownerId: string) {
    const [t] = await db.insert(tests).values({
      title: 'Import Test', batch: 'Import Batch', subject: 'Physics', date: '2026-09-01', totalMarks: 8, createdByUserId: ownerId,
    }).returning()
    createdTestIds.push(t.id)
    return t
  }

  async function createQuestion(ownerId: string, type: string, options: string[], correctAnswer: string, marks = 4) {
    const [q] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Kinematics', text: 'Q', type, options: JSON.stringify(options), correctAnswer, marks, negativeMarks: 1, unattemptedMarks: 0, createdByUserId: ownerId,
    }).returning()
    createdQuestionIds.push(q.id)
    return q
  }

  async function attachQuestions(testId: string, questionIds: string[]) {
    const res = await POST_QUESTIONS(req(`http://localhost/api/tests/${testId}/questions`, {
      method: 'POST', body: JSON.stringify({ questionIds }),
    }), { params: Promise.resolve({ id: testId }) })
    if (res.status !== 200) throw new Error(`Failed to attach questions: ${await res.text()}`)
  }

  async function createStudent(rollNo: string) {
    const [s] = await db.insert(students).values({ name: `Student ${rollNo}`, rollNo, batch: 'Import Batch', isActive: true }).returning()
    createdStudentIds.push(s.id)
    return s
  }

  it('grades MCQ + Numerical answers, saves ratings and PTM, and reports a summary', async () => {
    const owner = await createUser('Import Owner', 'teacher')
    const test = await createTest(owner.id)
    const mcq = await createQuestion(owner.id, 'MCQ', ['London', 'Paris', 'Berlin', 'Rome'], 'Option B')
    const numeric = await createQuestion(owner.id, 'Numerical', [], '42')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await attachQuestions(test.id, [mcq.id, numeric.id])
    const student = await createStudent('501')

    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-09-01',
        rows: [{
          rollNo: '501',
          answers: { [mcq.id]: 'A', [numeric.id]: '42' },
          mistakeTypes: { [mcq.id]: 'Conceptual Error' },
          attitude: 'Good', behaviour: 'Good', focus: 'Good', interaction: 'Good',
          ptmParentAttended: 'Yes', ptmDiscussionNotes: 'Good progress', ptmActionItems: 'Keep practicing',
        }],
      }),
    }), { params: Promise.resolve({ id: test.id }) })

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.summary.written).toBe(1)
    expect(body.summary.skipped).toEqual([])
    expect(body.summary.rowErrors).toEqual([])
    expect(body.test.status).toBe('Graded')

    const [response1] = await db.select().from(testQuestionResponses).where(eq(testQuestionResponses.questionId, mcq.id))
    expect(response1.status).toBe('Incorrect')
    expect(response1.mistakeType).toBe('Conceptual Error')
    expect(response1.marksAwarded).toBe(-1)

    const [response2] = await db.select().from(testQuestionResponses).where(eq(testQuestionResponses.questionId, numeric.id))
    expect(response2.status).toBe('Correct')
    expect(response2.marksAwarded).toBe(4)

    const [grade] = await db.select().from(testGrades).where(eq(testGrades.studentId, student.id))
    expect(grade.marksObtained).toBe(3)

    const [rating] = await db.select().from(dailyStudentRatings).where(eq(dailyStudentRatings.studentId, student.id))
    expect(rating.attitude).toBe('Good')

    const [ptm] = await db.select().from(ptmReports).where(eq(ptmReports.studentId, student.id))
    expect(ptm.parentAttended).toBe(true)
    expect(ptm.discussionNotes).toBe('Good progress')
  })

  it('skips a roll number not present in the roster, reporting it without failing the import', async () => {
    const owner = await createUser('Import Owner Two', 'teacher')
    const test = await createTest(owner.id)
    const mcq = await createQuestion(owner.id, 'MCQ', ['A1', 'A2'], 'A')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await attachQuestions(test.id, [mcq.id])
    await createStudent('601')

    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows: [{ rollNo: '999-does-not-exist', answers: { [mcq.id]: 'A' } }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.summary.written).toBe(0)
    expect(body.summary.skipped).toEqual([{ rollNo: '999-does-not-exist', reason: 'No matching student in this test\'s roster.' }])
  })

  it('overwrites a prior response on re-upload for the same student and test', async () => {
    const owner = await createUser('Import Owner Three', 'teacher')
    const test = await createTest(owner.id)
    const mcq = await createQuestion(owner.id, 'MCQ', ['A1', 'A2'], 'A')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await attachQuestions(test.id, [mcq.id])
    await createStudent('701')

    const firstImport = () => POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows: [{ rollNo: '701', answers: { [mcq.id]: 'A' } }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    await firstImport()

    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows: [{ rollNo: '701', answers: { [mcq.id]: 'B' } }] }),
    }), { params: Promise.resolve({ id: test.id }) })
    expect(res.status).toBe(200)

    const rows = await db.select().from(testQuestionResponses).where(eq(testQuestionResponses.questionId, mcq.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('Incorrect')
  })

  it('flags an MCQ question whose correctAnswer cannot be resolved, and writes no response for it', async () => {
    const owner = await createUser('Import Owner Four', 'teacher')
    const test = await createTest(owner.id)
    const badMcq = await createQuestion(owner.id, 'MCQ', ['A1', 'A2'], 'not a real option or letter')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })
    await attachQuestions(test.id, [badMcq.id])
    await createStudent('801')

    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows: [{ rollNo: '801', answers: { [badMcq.id]: 'A' } }] }),
    }), { params: Promise.resolve({ id: test.id }) })

    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.summary.unresolvableQuestions).toEqual([{ questionId: badMcq.id, topic: 'Kinematics' }])

    const rows = await db.select().from(testQuestionResponses).where(eq(testQuestionResponses.questionId, badMcq.id))
    expect(rows).toHaveLength(0)
  })

  it('rejects a request with more than 1000 rows', async () => {
    const owner = await createUser('Import Owner Five', 'teacher')
    const test = await createTest(owner.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: owner.id, role: 'teacher', schoolId: null } })

    const rows = Array.from({ length: 1001 }, (_, i) => ({ rollNo: String(i) }))
    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows }),
    }), { params: Promise.resolve({ id: test.id }) })

    expect(res.status).toBe(400)
  })

  it('returns 403 for a role other than teacher/management', async () => {
    const owner = await createUser('Import Owner Six', 'teacher')
    const test = await createTest(owner.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'someone', role: 'student', schoolId: null } })

    const res = await POST(req(`http://localhost/api/tests/${test.id}/import-results`, {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-01', rows: [] }),
    }), { params: Promise.resolve({ id: test.id }) })

    expect(res.status).toBe(403)
  })
})
