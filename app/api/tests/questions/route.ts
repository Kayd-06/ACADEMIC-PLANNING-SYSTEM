import { NextRequest, NextResponse } from 'next/server'
import { db, questions, users } from '@/lib/db'
import { eq, and, ilike, or, desc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch question bank questions. Teachers see only their own;
// management sees every question in the school plus each row's faculty name.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)
    const { searchParams } = new URL(req.url)
    const subject = searchParams.get('subject')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')
    const teacherId = searchParams.get('teacherId')

    const conditions: any[] = []
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (subject && subject !== 'All') conditions.push(eq(questions.subject, subject))
    if (difficulty && difficulty !== 'All') conditions.push(eq(questions.difficulty, difficulty))
    if (search) {
      conditions.push(
        or(
          ilike(questions.topic, `%${search}%`),
          ilike(questions.text, `%${search}%`)
        )
      )
    }
    if (role === 'teacher') {
      conditions.push(eq(questions.createdByUserId, userId))
    } else if (teacherId && teacherId !== 'All') {
      conditions.push(eq(questions.createdByUserId, teacherId))
    }

    const baseQuery = db
      .select({
        id: questions.id,
        subject: questions.subject,
        topic: questions.topic,
        difficulty: questions.difficulty,
        type: questions.type,
        text: questions.text,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        marks: questions.marks,
        negativeMarks: questions.negativeMarks,
        source: questions.source,
        createdByUserId: questions.createdByUserId,
        schoolId: questions.schoolId,
        createdAt: questions.createdAt,
        facultyName: users.name,
      })
      .from(questions)
      .leftJoin(users, eq(questions.createdByUserId, users.id))

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(questions.createdAt))
      : await baseQuery.orderBy(desc(questions.createdAt))

    const parsed = rows.map(q => ({
      ...q,
      options: (() => { try { return JSON.parse(q.options) } catch { return [] } })()
    }))

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a new question to the bank, owned by the creating user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { subject, topic, difficulty, type, text, options, correctAnswer, marks, negativeMarks, source } = body

    if (!subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string

    const [created] = await db.insert(questions).values({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      options: JSON.stringify(Array.isArray(options) ? options.map((o: string) => o.trim()).filter(Boolean) : []),
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      negativeMarks: negativeMarks ? Number(negativeMarks) : 0,
      source: source?.trim() || 'Custom',
      createdByUserId: userId,
      schoolId,
    }).returning()

    return NextResponse.json({
      ...created,
      options: (() => { try { return JSON.parse(created.options) } catch { return [] } })()
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit an existing question. Teachers may only edit their own.
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, subject, topic, difficulty, type, text, options, correctAnswer, marks, negativeMarks, source } = body

    if (!id || !subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(questions.id, id)]
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(questions.createdByUserId, userId))

    const [updated] = await db.update(questions).set({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      options: JSON.stringify(Array.isArray(options) ? options.map((o: string) => o.trim()).filter(Boolean) : []),
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      negativeMarks: negativeMarks ? Number(negativeMarks) : 0,
      source: source?.trim() || 'Custom',
      updatedAt: new Date(),
    }).where(and(...conditions)).returning()

    if (!updated) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

    return NextResponse.json({
      ...updated,
      options: (() => { try { return JSON.parse(updated.options) } catch { return [] } })()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a question from the bank. Teachers may only delete their own.
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing question ID.' }, { status: 400 })

    const schoolId = getSchoolId(session)
    const userId = (session.user as any).id as string
    const conditions: any[] = [eq(questions.id, id)]
    if (schoolId) conditions.push(eq(questions.schoolId, schoolId))
    if (role === 'teacher') conditions.push(eq(questions.createdByUserId, userId))

    const [deleted] = await db.delete(questions).where(and(...conditions)).returning()
    if (!deleted) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
