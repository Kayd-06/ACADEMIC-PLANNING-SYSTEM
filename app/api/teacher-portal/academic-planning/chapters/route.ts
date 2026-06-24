import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { SyllabusChapter } from '@/models/AcademicPlanning'

export const dynamic = 'force-dynamic'

const SEED_CHAPTERS = [
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 01: Physical World',
    estHours: '12 hrs est.',
    dates: 'Aug 15 - Aug 28',
    status: 'COMPLETED',
    notes: 'Introductory concepts clear. Ready for test.',
    order: 1
  },
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 02: Units and Measurements',
    estHours: '10 hrs est.',
    dates: 'Sep 01 - Sep 15',
    status: 'COMPLETED',
    notes: '',
    order: 2
  },
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 03: Motion in a Straight Line',
    estHours: '14 hrs est.',
    dates: 'Sep 16 - Oct 10',
    status: 'COMPLETED',
    notes: 'Students struggled with calculus derivations.',
    order: 3
  },
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 04: Kinematics',
    estHours: '15 hrs est.',
    dates: 'Oct 12 - Oct 25',
    status: 'IN PROGRESS',
    notes: 'Requires extra doubt session for relative velocity.',
    order: 4
  },
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 05: Laws of Motion',
    estHours: '10 hrs est.',
    dates: 'Oct 26 - Nov 05',
    status: 'NOT STARTED',
    notes: '',
    order: 5
  },
  {
    className: 'Grade 11-A',
    subject: 'Physics',
    title: 'Chapter 06: Work, Energy and Power',
    estHours: '16 hrs est.',
    dates: 'Nov 06 - Nov 25',
    status: 'NOT STARTED',
    notes: '',
    order: 6
  }
]

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const className = searchParams.get('class') || 'Grade 11-A'
    const subject = searchParams.get('subject') || 'Physics'

    let chapters = await SyllabusChapter.find({ className, subject }).sort({ order: 1 }).lean()

    // Seed if empty
    if (chapters.length === 0) {
      await SyllabusChapter.insertMany(SEED_CHAPTERS.filter(c => c.className === className && c.subject === subject))
      chapters = await SyllabusChapter.find({ className, subject }).sort({ order: 1 }).lean()
    }

    // Prepare response formatting to match what UI expects easily
    const formattedChapters = chapters.map((c: any) => ({
      _id: c._id.toString(),
      title: c.title,
      estHours: c.estHours,
      dates: c.dates,
      status: c.status,
      notes: c.notes,
      order: c.order
    }))

    return NextResponse.json({
      chapters: formattedChapters,
      totalChapters: 24, // Assuming 24 chapters total for the course
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    const { id, status, notes } = await req.json()

    if (!id) return NextResponse.json({ error: 'Missing chapter ID' }, { status: 400 })

    const updateData: any = {}
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    const updated = await SyllabusChapter.findByIdAndUpdate(id, updateData, { new: true })

    return NextResponse.json({ success: true, chapter: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
