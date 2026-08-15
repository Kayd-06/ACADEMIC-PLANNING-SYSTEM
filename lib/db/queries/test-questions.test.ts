import { eq } from 'drizzle-orm'
import { db } from '../index'
import { tests, questions } from '../schema'
import { listQuestionsForTest, setQuestionsForTest } from './test-questions'

describe('test-questions queries', () => {
  // Scoped-by-ID cleanup only — tests/questions are DB-Guard-protected tables;
  // an unscoped delete silently no-ops and leaks fixtures.
  const createdTestIds: string[] = []
  const createdQuestionIds: string[] = []

  afterEach(async () => {
    for (const id of createdTestIds) await db.delete(tests).where(eq(tests.id, id))
    createdTestIds.length = 0
    for (const id of createdQuestionIds) await db.delete(questions).where(eq(questions.id, id))
    createdQuestionIds.length = 0
  })

  async function createTest() {
    const [t] = await db.insert(tests).values({
      title: 'TQ Test', batch: 'TQ Batch', subject: 'Physics', date: '2026-08-01',
    }).returning()
    createdTestIds.push(t.id)
    return t
  }

  async function createQuestion(text: string) {
    const [q] = await db.insert(questions).values({ subject: 'Physics', topic: 'Motion', text }).returning()
    createdQuestionIds.push(q.id)
    return q
  }

  it('listQuestionsForTest returns an empty array when nothing is attached', async () => {
    const test = await createTest()
    const result = await listQuestionsForTest(test.id)
    expect(result).toEqual([])
  })

  it('setQuestionsForTest attaches questions in the given order', async () => {
    const test = await createTest()
    const q1 = await createQuestion('First Question')
    const q2 = await createQuestion('Second Question')

    await setQuestionsForTest(test.id, [q2.id, q1.id])

    const result = await listQuestionsForTest(test.id)
    expect(result.map(q => q.id)).toEqual([q2.id, q1.id])
    expect(result.map(q => q.orderIndex)).toEqual([0, 1])
  })

  it('setQuestionsForTest replaces the previous set rather than appending', async () => {
    const test = await createTest()
    const q1 = await createQuestion('Old Question')
    const q2 = await createQuestion('New Question')

    await setQuestionsForTest(test.id, [q1.id])
    await setQuestionsForTest(test.id, [q2.id])

    const result = await listQuestionsForTest(test.id)
    expect(result.map(q => q.id)).toEqual([q2.id])
  })

  it('setQuestionsForTest with an empty array clears the set', async () => {
    const test = await createTest()
    const q1 = await createQuestion('To Be Cleared')

    await setQuestionsForTest(test.id, [q1.id])
    await setQuestionsForTest(test.id, [])

    const result = await listQuestionsForTest(test.id)
    expect(result).toEqual([])
  })
})
