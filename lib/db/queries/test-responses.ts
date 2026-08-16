import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { testQuestionResponses, testGrades, questions, students } from '../schema'

export type ResponseStatus = 'Correct' | 'Incorrect' | 'Unattempted'

export interface ResponseInput {
  studentId: string
  questionId: string
  status: ResponseStatus
  mistakeType?: string
}

export interface ResponseGridEntry {
  questionId: string
  studentId: string
  status: ResponseStatus
  mistakeType?: string
  marksAwarded: number
}

export async function getResponseGrid(testId: string): Promise<ResponseGridEntry[]> {
  const rows = await db.select().from(testQuestionResponses).where(eq(testQuestionResponses.testId, testId))
  return rows.map(r => ({ questionId: r.questionId, studentId: r.studentId, status: r.status, mistakeType: r.mistakeType || undefined, marksAwarded: r.marksAwarded }))
}

// Bulk upserts per-question responses for a test, then recomputes and
// upserts each affected student's test_grades cache row so every existing
// reader of test_grades (Student Reports, rank/percentile) keeps working
// unmodified.
export async function saveResponses(
  testId: string,
  responses: ResponseInput[],
  gradedByUserId: string,
  schoolId: string | null
): Promise<void> {
  if (responses.length === 0) return

  const questionIds = [...new Set(responses.map(r => r.questionId))]
  const questionRows = await db.select().from(questions).where(inArray(questions.id, questionIds))
  const questionById = new Map(questionRows.map(q => [q.id, q]))

  for (const r of responses) {
    const question = questionById.get(r.questionId)
    if (!question) continue

    const marksAwarded = r.status === 'Correct' ? question.marks
      : r.status === 'Incorrect' ? -question.negativeMarks
      : question.unattemptedMarks

    const values = {
      testId,
      questionId: r.questionId,
      studentId: r.studentId,
      status: r.status,
      mistakeType: r.status === 'Incorrect' ? r.mistakeType : null,
      marksAwarded,
      gradedByUserId,
      schoolId,
      updatedAt: new Date(),
    }

    const [existing] = await db.select().from(testQuestionResponses)
      .where(and(
        eq(testQuestionResponses.testId, testId),
        eq(testQuestionResponses.questionId, r.questionId),
        eq(testQuestionResponses.studentId, r.studentId)
      ))

    if (existing) {
      await db.update(testQuestionResponses).set(values).where(eq(testQuestionResponses.id, existing.id))
    } else {
      await db.insert(testQuestionResponses).values(values)
    }
  }

  const studentIds = [...new Set(responses.map(r => r.studentId))]
  const studentRows = await db.select().from(students).where(inArray(students.id, studentIds))
  const studentById = new Map(studentRows.map(s => [s.id, s]))

  for (const studentId of studentIds) {
    await recomputeTestGrade(testId, studentId, studentById.get(studentId)?.rollNo || '', gradedByUserId, schoolId)
  }
}

async function recomputeTestGrade(
  testId: string,
  studentId: string,
  rollNo: string,
  gradedByUserId: string,
  schoolId: string | null
): Promise<void> {
  const rows = await db.select().from(testQuestionResponses)
    .where(and(eq(testQuestionResponses.testId, testId), eq(testQuestionResponses.studentId, studentId)))

  const marksObtained = rows.reduce((sum, r) => sum + r.marksAwarded, 0)
  const correct = rows.filter(r => r.status === 'Correct').length
  const incorrect = rows.filter(r => r.status === 'Incorrect').length
  const unattempted = rows.filter(r => r.status === 'Unattempted').length

  const values = {
    testId,
    studentId,
    rollNo,
    marksObtained,
    correct,
    incorrect,
    unattempted,
    absent: false,
    gradedByUserId,
    schoolId,
    updatedAt: new Date(),
  }

  const [existing] = await db.select().from(testGrades)
    .where(and(eq(testGrades.testId, testId), eq(testGrades.studentId, studentId)))

  if (existing) {
    await db.update(testGrades).set(values).where(eq(testGrades.id, existing.id))
  } else {
    await db.insert(testGrades).values(values)
  }
}
