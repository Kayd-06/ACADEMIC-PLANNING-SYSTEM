import { NextRequest, NextResponse } from 'next/server'
import { db, questions } from '@/lib/db'
import { eq, and, ilike, or, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch question bank questions (scoped to school)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)
    const subject = searchParams.get('subject')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')

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

    const rows = conditions.length > 0
      ? await db.select().from(questions).where(and(...conditions)).orderBy(desc(questions.createdAt))
      : await db.select().from(questions).orderBy(desc(questions.createdAt))

    // Parse options from JSON string back to array for the client
    const parsed = rows.map(q => ({
      ...q,
      options: (() => { try { return JSON.parse(q.options) } catch { return [] } })()
    }))

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — add a new question to the bank
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

    const schoolId = (session.user as any).schoolId as string | null

    const [created] = await db.insert(questions).values({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      // Store options as JSON string
      options: JSON.stringify(Array.isArray(options) ? options.map((o: string) => o.trim()).filter(Boolean) : []),
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      negativeMarks: negativeMarks ? Number(negativeMarks) : 0,
      source: source?.trim() || 'Custom',
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

// PUT — edit an existing question
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

    const schoolId = (session.user as any).schoolId as string | null
    const condition = schoolId ? and(eq(questions.id, id), eq(questions.schoolId, schoolId)) : eq(questions.id, id)

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
    }).where(condition).returning()

    if (!updated) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

    return NextResponse.json({
      ...updated,
      options: (() => { try { return JSON.parse(updated.options) } catch { return [] } })()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove a question from the bank
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

    const schoolId = (session.user as any).schoolId as string | null
    const condition = schoolId ? and(eq(questions.id, id), eq(questions.schoolId, schoolId)) : eq(questions.id, id)

    const [deleted] = await db.delete(questions).where(condition).returning()
    if (!deleted) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
