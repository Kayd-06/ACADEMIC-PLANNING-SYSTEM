import { NextRequest, NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { findStudentsByBatch, findStudentsByBatchId } from '@/lib/db/queries/students'
import { listQuestionsForTest } from '@/lib/db/queries/test-questions'
import { getResponseGrid, saveResponses, type ResponseStatus } from '@/lib/db/queries/test-responses'
import { getLocalToday } from '@/lib/scheduleUtils'
import { finalizeGradedTest } from '@/lib/reports/test-grading-finalize'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: ResponseStatus[] = ['Correct', 'Incorrect', 'Unattempted']

import { loadAuthorizedTest } from '@/lib/db/queries/tests-auth'

// batchId is preferred once a test has one (real FK, not string match);
// falls back to the free-text batch for tests scheduled before Part 1.
async function loadRoster(test: { batch: string; batchId: string | null; schoolId: string | null }) {
  return test.batchId
    ? findStudentsByBatchId(test.batchId, test.schoolId)
    : findStudentsByBatch(test.batch, test.schoolId)
}

// GET — roster x attached-question response grid for a test. This is the
// grid the per-question grading UI will render; the legacy grades GET stays
// as-is and keeps reading test_grades directly.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const [attachedQuestions, roster, grid] = await Promise.all([
      listQuestionsForTest(test.id),
      loadRoster(test),
      getResponseGrid(test.id),
    ])

    const statusByStudentAndQuestion = new Map(grid.map(r => [`${r.studentId}:${r.questionId}`, r.status]))
    const mistakeTypeByStudentAndQuestion = new Map(grid.map(r => [`${r.studentId}:${r.questionId}`, r.mistakeType]))

    const studentResults = roster.map(s => ({
      studentId: s.id,
      studentName: s.name,
      rollNo: s.rollNo || '',
      responses: Object.fromEntries(
        attachedQuestions.map(q => [
          q.id,
          statusByStudentAndQuestion.get(`${s.id}:${q.id}`) ?? null
        ])
      ),
      mistakes: Object.fromEntries(
        attachedQuestions.map(q => [
          q.id,
          mistakeTypeByStudentAndQuestion.get(`${s.id}:${q.id}`) ?? null
        ])
      ),
    }))

    return NextResponse.json({ test, questions: attachedQuestions, studentResults })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — bulk-save per-question responses, recompute the test_grades cache,
// and flip the test to Graded — the same downstream effects the legacy
// grades POST produces, so nothing reading test.status/averageScore/
// test_grades needs to know which grading path was used.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const body = await req.json()
    const responses = body.responses
    if (!Array.isArray(responses)) {
      return NextResponse.json({ error: 'Missing responses array.' }, { status: 400 })
    }

    const [attachedQuestions, roster] = await Promise.all([
      listQuestionsForTest(test.id),
      loadRoster(test),
    ])
    const attachedQuestionIds = new Set(attachedQuestions.map(q => q.id))
    const rosterIds = new Set(roster.map(s => s.id))

    const valid = responses.filter((r: any) =>
      r && rosterIds.has(r.studentId) && attachedQuestionIds.has(r.questionId) && VALID_STATUSES.includes(r.status)
    )

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid responses to save.' }, { status: 400 })
    }

    const userId = (session.user as any).id as string
    await saveResponses(test.id, valid, userId, test.schoolId)

    const { updatedTest } = await finalizeGradedTest(test)

    return NextResponse.json({ success: true, test: updatedTest })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
