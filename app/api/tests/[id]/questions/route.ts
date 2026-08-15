import { NextRequest, NextResponse } from 'next/server'
import { db, tests, questions } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { listQuestionsForTest, setQuestionsForTest } from '@/lib/db/queries/test-questions'

export const dynamic = 'force-dynamic'

async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return null

  const role = (session.user as any).role
  const userId = (session.user as any).id as string
  const schoolId = getSchoolId(session)

  if (role !== 'teacher' && role !== 'management') return null
  if (schoolId && test.schoolId !== schoolId) return null
  if (role === 'teacher' && test.createdByUserId !== userId) return null

  return test
}

// GET — the question set currently attached to a test, in order.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const attached = await listQuestionsForTest(test.id)
    return NextResponse.json(attached)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — replace the test's question set with the given question-bank IDs,
// in order. IDs outside the caller's own school (or, for a teacher, outside
// their own question bank) are silently dropped rather than erroring, so a
// stale client-side selection can't attach someone else's question.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const body = await req.json()
    const questionIds = body.questionIds
    if (!Array.isArray(questionIds)) {
      return NextResponse.json({ error: 'Missing questionIds array.' }, { status: 400 })
    }

    const role = (session.user as any).role
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)

    const conditions: any[] = [inArray(questions.id, questionIds)]
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(questions.createdByUserId, userId))

    const validQuestions = questionIds.length > 0
      ? await db.select({ id: questions.id }).from(questions).where(and(...conditions))
      : []
    const validIds = new Set(validQuestions.map(q => q.id))
    const orderedValidIds = questionIds.filter((qid: string) => validIds.has(qid))

    await setQuestionsForTest(test.id, orderedValidIds)

    const attached = await listQuestionsForTest(test.id)
    return NextResponse.json(attached)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
