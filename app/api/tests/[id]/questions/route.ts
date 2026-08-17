import { NextRequest, NextResponse } from 'next/server'
import { db, questions, users } from '@/lib/db'
import { eq, and, inArray, isNull, or } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { listQuestionsForTest, setQuestionsForTest } from '@/lib/db/queries/test-questions'
import { loadAuthorizedTest } from '@/lib/db/queries/tests-auth'

export const dynamic = 'force-dynamic'

// GET — the question set currently attached to a test, in order.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const attached = await listQuestionsForTest(test.id)
    return NextResponse.json(attached)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — replace the test's question set with the given question-bank IDs,
// in order. IDs outside the caller's own school (or, for a teacher, outside
// their accessible question bank) are silently dropped rather than erroring.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    if (role === 'teacher') {
      const managementRows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'management'))
      const allowedUserIds = [userId, ...managementRows.map(u => u.id)]
      conditions.push(or(inArray(questions.createdByUserId, allowedUserIds), isNull(questions.createdByUserId)))
    }

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
