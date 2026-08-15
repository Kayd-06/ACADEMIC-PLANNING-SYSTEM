import { eq, asc } from 'drizzle-orm'
import { db } from '../index'
import { testQuestions, questions, type Question } from '../schema'

export interface TestQuestionEntry extends Question {
  orderIndex: number
}

export async function listQuestionsForTest(testId: string): Promise<TestQuestionEntry[]> {
  const rows = await db
    .select({ question: questions, orderIndex: testQuestions.orderIndex })
    .from(testQuestions)
    .innerJoin(questions, eq(testQuestions.questionId, questions.id))
    .where(eq(testQuestions.testId, testId))
    .orderBy(asc(testQuestions.orderIndex))

  return rows.map(r => ({ ...r.question, orderIndex: r.orderIndex }))
}

// Replaces the full question set for a test with the given question IDs, in order.
export async function setQuestionsForTest(testId: string, questionIds: string[]): Promise<void> {
  await db.delete(testQuestions).where(eq(testQuestions.testId, testId))
  if (questionIds.length === 0) return
  await db.insert(testQuestions).values(
    questionIds.map((questionId, index) => ({ testId, questionId, orderIndex: index }))
  )
}
