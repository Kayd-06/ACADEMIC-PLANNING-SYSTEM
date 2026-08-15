import { eq, and } from 'drizzle-orm'
import { db } from '../index'
import { tests, questions, students, users, testGrades, testQuestionResponses } from '../schema'
import { saveResponses, getResponseGrid } from './test-responses'

describe('test-responses queries', () => {
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
  })

  async function createGrader() {
    const [u] = await db.insert(users).values({
      name: 'TR Grader', email: `tr-grader-${Date.now()}@example.com`, password: 'x', role: 'teacher',
    }).returning()
    createdUserIds.push(u.id)
    return u
  }

  async function createTest() {
    const [t] = await db.insert(tests).values({
      title: 'TR Test', batch: 'TR Batch', subject: 'Physics', date: '2026-08-01', totalMarks: 100,
    }).returning()
    createdTestIds.push(t.id)
    return t
  }

  async function createQuestion(marks: number, negativeMarks: number, unattemptedMarks: number) {
    const [q] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Motion', text: 'Q', marks, negativeMarks, unattemptedMarks,
    }).returning()
    createdQuestionIds.push(q.id)
    return q
  }

  async function createStudent() {
    const [s] = await db.insert(students).values({ name: 'TR Student', batch: 'TR Batch', isActive: true }).returning()
    createdStudentIds.push(s.id)
    return s
  }

  it('saveResponses computes marksAwarded from the question marking scheme', async () => {
    const test = await createTest()
    const correctQ = await createQuestion(4, 1, 0)
    const incorrectQ = await createQuestion(4, 1, 0)
    const unattemptedQ = await createQuestion(4, 1, -1)
    const student = await createStudent()
    const grader = await createGrader()

    await saveResponses(test.id, [
      { studentId: student.id, questionId: correctQ.id, status: 'Correct' },
      { studentId: student.id, questionId: incorrectQ.id, status: 'Incorrect' },
      { studentId: student.id, questionId: unattemptedQ.id, status: 'Unattempted' },
    ], grader.id, null)

    const grid = await getResponseGrid(test.id)
    const byQuestion = Object.fromEntries(grid.map(r => [r.questionId, r.marksAwarded]))
    expect(byQuestion[correctQ.id]).toBe(4)
    expect(byQuestion[incorrectQ.id]).toBe(-1)
    expect(byQuestion[unattemptedQ.id]).toBe(-1)
  })

  it('saveResponses recomputes the test_grades cache row', async () => {
    const test = await createTest()
    const q1 = await createQuestion(4, 1, 0)
    const q2 = await createQuestion(4, 1, 0)
    const student = await createStudent()
    const grader = await createGrader()

    await saveResponses(test.id, [
      { studentId: student.id, questionId: q1.id, status: 'Correct' },
      { studentId: student.id, questionId: q2.id, status: 'Incorrect' },
    ], grader.id, null)

    const [grade] = await db.select().from(testGrades)
      .where(and(eq(testGrades.testId, test.id), eq(testGrades.studentId, student.id)))
    expect(grade.marksObtained).toBe(3)
    expect(grade.correct).toBe(1)
    expect(grade.incorrect).toBe(1)
    expect(grade.unattempted).toBe(0)
  })

  it('saveResponses is idempotent — saving the same response twice updates rather than duplicates', async () => {
    const test = await createTest()
    const q1 = await createQuestion(4, 1, 0)
    const student = await createStudent()
    const grader = await createGrader()

    await saveResponses(test.id, [{ studentId: student.id, questionId: q1.id, status: 'Incorrect' }], grader.id, null)
    await saveResponses(test.id, [{ studentId: student.id, questionId: q1.id, status: 'Correct' }], grader.id, null)

    const rows = await db.select().from(testQuestionResponses)
      .where(and(eq(testQuestionResponses.testId, test.id), eq(testQuestionResponses.studentId, student.id)))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('Correct')
    expect(rows[0].marksAwarded).toBe(4)
  })
})
