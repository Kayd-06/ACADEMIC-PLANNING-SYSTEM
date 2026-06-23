import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Question from '@/models/Question'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch question bank questions
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const subject = searchParams.get('subject')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')

    const query: Record<string, any> = {}
    if (subject && subject !== 'All') query.subject = subject
    if (difficulty && difficulty !== 'All') query.difficulty = difficulty
    
    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ]
    }

    const questions = await Question.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json(questions)
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

    await connectDB()

    const body = await req.json()
    const { subject, topic, difficulty, type, text, options, correctAnswer, marks, source } = body

    if (!subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const question = await Question.create({
      subject: subject.trim(),
      topic: topic.trim(),
      difficulty,
      type,
      text: text.trim(),
      options: Array.isArray(options) ? options.map(o => o.trim()).filter(Boolean) : [],
      correctAnswer: correctAnswer?.trim() || '',
      marks: marks ? Number(marks) : 4,
      source: source?.trim() || 'Custom'
    })

    return NextResponse.json(question, { status: 201 })
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

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing question ID.' }, { status: 400 })
    }

    await Question.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — edit a question
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { id, subject, topic, difficulty, type, text, options, correctAnswer, marks, source } = body

    if (!id || !subject?.trim() || !topic?.trim() || !difficulty || !type || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const question = await Question.findByIdAndUpdate(
      id,
      {
        subject: subject.trim(),
        topic: topic.trim(),
        difficulty,
        type,
        text: text.trim(),
        options: Array.isArray(options) ? options.map(o => o.trim()).filter(Boolean) : [],
        correctAnswer: correctAnswer?.trim() || '',
        marks: marks ? Number(marks) : 4,
        source: source?.trim() || 'Custom'
      },
      { new: true }
    )

    return NextResponse.json(question)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


