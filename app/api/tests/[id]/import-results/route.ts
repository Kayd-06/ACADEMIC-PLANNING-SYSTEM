import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadAuthorizedTest } from '@/lib/db/queries/tests-auth'
import { listQuestionsForTest } from '@/lib/db/queries/test-questions'
import { findStudentsByBatch, findStudentsByBatchId } from '@/lib/db/queries/students'
import { saveResponses, type ResponseInput } from '@/lib/db/queries/test-responses'
import { saveDailyStudentRatings, type SaveRatingInput } from '@/lib/db/queries/daily-ratings'
import { savePtmReport } from '@/lib/db/queries/ptm-reports'
import { finalizeGradedTest } from '@/lib/reports/test-grading-finalize'
import { gradeAnswer, resolveMcqCorrectLetter } from '@/lib/reports/answer-grading'
import { validateImportRows } from '@/lib/reports/test-results-import'

export const dynamic = 'force-dynamic'

// Same batchId-preferred / batch-fallback roster lookup as the manual
// per-question grading route — keeps both grading paths seeing the same
// roster for the same test.
async function loadRoster(test: { batch: string; batchId: string | null; schoolId: string | null }) {
  return test.batchId
    ? findStudentsByBatchId(test.batchId, test.schoolId)
    : findStudentsByBatch(test.batch, test.schoolId)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'The import request is not valid JSON.' }, { status: 400 })
    }

    const date = typeof body.date === 'string' && body.date ? body.date : test.date

    const [attachedQuestions, roster] = await Promise.all([
      listQuestionsForTest(test.id),
      loadRoster(test),
    ])
    const questionIds = attachedQuestions.map((q) => q.id)

    let validRows, rowErrors
    try {
      ;({ validRows, rowErrors } = validateImportRows(body.rows, questionIds))
    } catch (validationError: any) {
      return NextResponse.json({ error: validationError.message }, { status: 400 })
    }

    const studentByRollNo = new Map(roster.filter((s) => s.rollNo).map((s) => [s.rollNo!.toLowerCase(), s]))

    // A question's gradability depends only on its own correctAnswer/options,
    // not on any student's row — resolve each attached MCQ question once.
    const unresolvableQuestions = attachedQuestions.filter(
      (q) => q.type === 'MCQ' && resolveMcqCorrectLetter(q.correctAnswer, JSON.parse(q.options || '[]')) === null
    )
    const unresolvableQuestionIds = new Set(unresolvableQuestions.map((q) => q.id))

    const skipped: Array<{ rollNo: string; reason: string }> = []
    const responseInputs: ResponseInput[] = []
    const ratingsToSave: SaveRatingInput[] = []
    const ptmToSave: Array<{ studentId: string; input: Parameters<typeof savePtmReport>[0] }> = []
    let written = 0

    for (const row of validRows) {
      const student = studentByRollNo.get(row.rollNo.toLowerCase())
      if (!student) {
        skipped.push({ rollNo: row.rollNo, reason: "No matching student in this test's roster." })
        continue
      }

      let rowWrote = false

      for (const question of attachedQuestions) {
        if (unresolvableQuestionIds.has(question.id)) continue
        const rawAnswer = row.answers[question.id]
        if (rawAnswer === undefined) continue

        const outcome = gradeAnswer(
          { type: question.type as any, options: JSON.parse(question.options || '[]'), correctAnswer: question.correctAnswer },
          rawAnswer
        )
        if (outcome.kind !== 'graded') continue

        responseInputs.push({
          studentId: student.id,
          questionId: question.id,
          status: outcome.status,
          mistakeType: outcome.status === 'Incorrect' ? row.mistakeTypes[question.id] : undefined,
        })
        rowWrote = true
      }

      if (row.rating) {
        ratingsToSave.push({ studentId: student.id, ...row.rating })
        rowWrote = true
      }

      if (row.ptm) {
        ptmToSave.push({
          studentId: student.id,
          input: {
            studentId: student.id,
            batch: test.batch,
            batchId: test.batchId,
            date,
            parentName: row.ptm.parentName,
            parentAttended: row.ptm.parentAttended,
            discussionNotes: row.ptm.discussionNotes,
            actionItems: row.ptm.actionItems,
            followUpDate: row.ptm.followUpDate || undefined,
            facultyId: (session.user as any).id,
            schoolId: test.schoolId,
          },
        })
        rowWrote = true
      }

      if (rowWrote) written++
    }

    const userId = (session.user as any).id as string
    if (responseInputs.length > 0) {
      await saveResponses(test.id, responseInputs, userId, test.schoolId)
    }
    if (ratingsToSave.length > 0) {
      await saveDailyStudentRatings(test.batch, date, ratingsToSave, userId, test.schoolId, test.batchId)
    }
    for (const { input } of ptmToSave) {
      await savePtmReport(input)
    }

    const resultTest = responseInputs.length > 0
      ? (await finalizeGradedTest(test)).updatedTest
      : test

    return NextResponse.json({
      success: true,
      test: resultTest,
      summary: {
        written,
        skipped,
        rowErrors,
        unresolvableQuestions: unresolvableQuestions.map((q) => ({ questionId: q.id, topic: q.topic })),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
