import { eq, and, inArray, sql } from 'drizzle-orm'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'
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
//
// Previously this ran 2 queries per response and 3 per student strictly one
// after another (a 1000-row import x 90 questions could never finish). Now it
// is multi-row upserts on the existing unique keys, in chunks.
const RESPONSE_CHUNK = 500
const GRADE_CHUNK = 500

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

  // One value per (question, student) — a multi-row ON CONFLICT statement may
  // not touch the same row twice; the last occurrence wins, as before.
  const byKey = new Map<string, typeof testQuestionResponses.$inferInsert>()
  for (const r of responses) {
    const question = questionById.get(r.questionId)
    if (!question) continue

    const marksAwarded = r.status === 'Correct' ? question.marks
      : r.status === 'Incorrect' ? -question.negativeMarks
      : question.unattemptedMarks

    byKey.set(`${r.questionId}|${r.studentId}`, {
      testId,
      questionId: r.questionId,
      studentId: r.studentId,
      status: r.status,
      mistakeType: r.status === 'Incorrect' ? (r.mistakeType ?? null) : null,
      marksAwarded,
      gradedByUserId,
      schoolId,
    })
  }

  const values = [...byKey.values()]
  await runChunks(chunk(values, RESPONSE_CHUNK), part =>
    db.insert(testQuestionResponses).values(part).onConflictDoUpdate({
      target: [testQuestionResponses.testId, testQuestionResponses.questionId, testQuestionResponses.studentId],
      set: {
        status: sql.raw('excluded.status'),
        // an Incorrect re-grade without a mistake type keeps the stored one (as before)
        mistakeType: sql.raw(`case when excluded.status = 'Incorrect' then coalesce(excluded.mistake_type, "test_question_responses".mistake_type) else null end`),
        marksAwarded: sql.raw('excluded.marks_awarded'),
        gradedByUserId: sql.raw('excluded.graded_by_user_id'),
        schoolId: sql.raw('excluded.school_id'),
        updatedAt: sql`now()`,
      },
    })
  )

  const studentIds = [...new Set(values.map(v => v.studentId))]
  await recomputeTestGrades(testId, studentIds, gradedByUserId, schoolId)
}

async function runChunks<T>(parts: T[][], write: (part: T[]) => Promise<unknown>) {
  const results = await mapWithConcurrency(parts, 3, write)
  const failure = results.find(r => r.status === 'rejected')
  if (failure && failure.status === 'rejected') throw failure.reason
}

async function recomputeTestGrades(
  testId: string,
  studentIds: string[],
  gradedByUserId: string,
  schoolId: string | null
): Promise<void> {
  if (studentIds.length === 0) return
  const [responseRows, studentRows] = await Promise.all([
    db.select({
      studentId: testQuestionResponses.studentId,
      status: testQuestionResponses.status,
      marksAwarded: testQuestionResponses.marksAwarded,
    }).from(testQuestionResponses)
      .where(and(eq(testQuestionResponses.testId, testId), inArray(testQuestionResponses.studentId, studentIds))),
    db.select({ id: students.id, rollNo: students.rollNo }).from(students).where(inArray(students.id, studentIds)),
  ])
  const rollById = new Map(studentRows.map(s => [s.id, s.rollNo || '']))

  const totals = new Map<string, { marksObtained: number; correct: number; incorrect: number; unattempted: number }>()
  for (const id of studentIds) totals.set(id, { marksObtained: 0, correct: 0, incorrect: 0, unattempted: 0 })
  for (const r of responseRows) {
    const t = totals.get(r.studentId)!
    t.marksObtained += r.marksAwarded
    if (r.status === 'Correct') t.correct++
    else if (r.status === 'Incorrect') t.incorrect++
    else if (r.status === 'Unattempted') t.unattempted++
  }

  const grades = studentIds.map(studentId => ({
    testId,
    studentId,
    rollNo: rollById.get(studentId) ?? '',
    ...totals.get(studentId)!,
    absent: false,
    gradedByUserId,
    schoolId,
  }))
  await runChunks(chunk(grades, GRADE_CHUNK), part =>
    db.insert(testGrades).values(part).onConflictDoUpdate({
      target: [testGrades.testId, testGrades.studentId],
      set: {
        rollNo: sql.raw('excluded.roll_no'),
        marksObtained: sql.raw('excluded.marks_obtained'),
        correct: sql.raw('excluded.correct'),
        incorrect: sql.raw('excluded.incorrect'),
        unattempted: sql.raw('excluded.unattempted'),
        absent: false,
        gradedByUserId: sql.raw('excluded.graded_by_user_id'),
        schoolId: sql.raw('excluded.school_id'),
        updatedAt: sql`now()`,
      },
    })
  )
}
