import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Assignment from '@/models/Assignment'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to format due date relative to today
function getRelativeDateString(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

// Seeding function for 42 assignments
async function seedAssignments(teacherEmail: string) {
  const count = await Assignment.countDocuments({ teacherEmail })
  if (count > 0) return

  const assignmentsList = [
    // Page 1 matches
    {
      title: 'Calculus Integration DPP 04',
      chapter: 'Chapter 5: Definite Integrals',
      batch: 'Grade 11-A',
      subject: 'Mathematics',
      type: 'DPP',
      dueDate: getRelativeDateString(2),
      dueTime: '11:59 PM',
      submittedCount: 34,
      totalStudents: 40,
      status: 'Active',
      teacherEmail
    },
    {
      title: 'Physics Kinematics Homework',
      chapter: 'Chapter 2: Motion in 1D',
      batch: 'Grade 11-B',
      subject: 'Physics',
      type: 'Homework',
      dueDate: getRelativeDateString(-1),
      dueTime: '11:59 PM',
      submittedCount: 40,
      totalStudents: 40,
      status: 'Overdue Eval',
      teacherEmail
    },
    {
      title: 'Organic Chemistry Nomenclature',
      chapter: 'Chapter 12: Basic Principles',
      batch: 'Grade 11-A',
      subject: 'Chemistry',
      type: 'DPP',
      dueDate: getRelativeDateString(-3),
      dueTime: '11:59 PM',
      submittedCount: 38,
      totalStudents: 40,
      status: 'Evaluated',
      teacherEmail
    },
    // Generate the remaining 39 assignments to make exactly 42
    {
      title: 'Trigonometric Functions DPP 01',
      chapter: 'Chapter 3: Trigonometry',
      batch: 'Grade 11-A',
      subject: 'Mathematics',
      type: 'DPP',
      dueDate: getRelativeDateString(-5),
      dueTime: '11:59 PM',
      submittedCount: 40,
      totalStudents: 40,
      status: 'Evaluated',
      teacherEmail
    },
    {
      title: 'Rotational Mechanics Homework',
      chapter: 'Chapter 7: Rotational Motion',
      batch: 'Grade 11-B',
      subject: 'Physics',
      type: 'Homework',
      dueDate: getRelativeDateString(4),
      dueTime: '11:59 PM',
      submittedCount: 15,
      totalStudents: 40,
      status: 'Active',
      teacherEmail
    },
    {
      title: 'Chemical Equilibrium DPP 06',
      chapter: 'Chapter 6: Equilibrium',
      batch: 'Grade 11-A',
      subject: 'Chemistry',
      type: 'DPP',
      dueDate: getRelativeDateString(-8),
      dueTime: '11:59 PM',
      submittedCount: 36,
      totalStudents: 40,
      status: 'Evaluated',
      teacherEmail
    },
    {
      title: 'Limits & Derivatives Homework',
      chapter: 'Chapter 13: Calculus Basics',
      batch: 'Grade 11-B',
      subject: 'Mathematics',
      type: 'Homework',
      dueDate: getRelativeDateString(-2),
      dueTime: '11:59 PM',
      submittedCount: 39,
      totalStudents: 40,
      status: 'Overdue Eval',
      teacherEmail
    },
    {
      title: 'Thermodynamics DPP 03',
      chapter: 'Chapter 12: Heat & Thermodynamics',
      batch: 'Grade 11-A',
      subject: 'Physics',
      type: 'DPP',
      dueDate: getRelativeDateString(5),
      dueTime: '11:59 PM',
      submittedCount: 12,
      totalStudents: 40,
      status: 'Active',
      teacherEmail
    },
    {
      title: 'Atomic Structure DPP 02',
      chapter: 'Chapter 2: Structure of Atom',
      batch: 'Grade 11-B',
      subject: 'Chemistry',
      type: 'DPP',
      dueDate: getRelativeDateString(-12),
      dueTime: '11:59 PM',
      submittedCount: 40,
      totalStudents: 40,
      status: 'Evaluated',
      teacherEmail
    },
    {
      title: 'Probability Theory Homework',
      chapter: 'Chapter 16: Probability',
      batch: 'Grade 11-A',
      subject: 'Mathematics',
      type: 'Homework',
      dueDate: getRelativeDateString(6),
      dueTime: '11:59 PM',
      submittedCount: 8,
      totalStudents: 40,
      status: 'Active',
      teacherEmail
    }
  ]

  // Add 32 more mock assignments to reach exactly 42
  const subjects = ['Mathematics', 'Physics', 'Chemistry']
  const chapters = [
    'Chapter 1: Sets & Relations',
    'Chapter 4: Quadratic Equations',
    'Chapter 8: Gravitation',
    'Chapter 10: Mechanical Properties of Fluids',
    'Chapter 3: Classification of Elements',
    'Chapter 4: Chemical Bonding'
  ]
  const batches = ['Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B']

  for (let i = 11; i <= 42; i++) {
    const isDPP = i % 2 === 0
    const offset = -1 * (i - 8) // past dates
    const total = batches[i % batches.length].startsWith('Grade 11') ? 60 : 65
    const subCount = Math.floor(total * (0.6 + Math.random() * 0.4))
    
    assignmentsList.push({
      title: `${isDPP ? 'DPP' : 'Homework'} Assessment #${i}`,
      chapter: chapters[i % chapters.length],
      batch: batches[i % batches.length],
      subject: subjects[i % subjects.length],
      type: isDPP ? 'DPP' : 'Homework',
      dueDate: getRelativeDateString(offset),
      dueTime: '11:59 PM',
      submittedCount: subCount,
      totalStudents: total,
      status: i % 5 === 0 ? 'Overdue Eval' : 'Evaluated',
      teacherEmail
    })
  }

  await Assignment.insertMany(assignmentsList)
}

// GET — query list of assignments
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const email = session.user.email?.toLowerCase() || ''
    await seedAssignments(email)

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'All'
    const batch = searchParams.get('batch') || 'All'

    const query: Record<string, any> = { teacherEmail: email }
    if (type !== 'All') {
      query.type = type
    }
    if (batch !== 'All') {
      query.batch = batch
    }

    // Sort: Active first, then Overdue Eval, then Evaluated, and descending by dueDate
    const list = await Assignment.find(query).lean()
    
    const statusPriority = { 'Active': 1, 'Overdue Eval': 2, 'Evaluated': 3 }
    
    list.sort((a: any, b: any) => {
      const ap = statusPriority[a.status as keyof typeof statusPriority] || 3
      const bp = statusPriority[b.status as keyof typeof statusPriority] || 3
      if (ap !== bp) return ap - bp
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
    })

    return NextResponse.json(list)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create new assignment
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const email = session.user.email?.toLowerCase() || ''
    
    const body = await req.json()
    const { title, chapter, batch, subject, type, dueDate, dueTime, totalStudents } = body

    if (!title || !chapter || !batch || !subject || !type || !dueDate) {
      return NextResponse.json({ error: 'Missing required assignment fields' }, { status: 400 })
    }

    const newAssignment = await Assignment.create({
      title,
      chapter,
      batch,
      subject,
      type,
      dueDate,
      dueTime: dueTime || '11:59 PM',
      submittedCount: 0,
      totalStudents: Number(totalStudents) || 40,
      status: 'Active',
      teacherEmail: email
    })

    return NextResponse.json(newAssignment, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — update submission count or evaluate status
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const body = await req.json()
    const { id, status, submittedCount } = body

    if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

    const updateFields: Record<string, any> = {}
    if (status !== undefined) updateFields.status = status
    if (submittedCount !== undefined) updateFields.submittedCount = Number(submittedCount)

    const updated = await Assignment.findByIdAndUpdate(id, updateFields, { new: true })
    if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — cancel/delete assignment
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

    const deleted = await Assignment.findByIdAndDelete(id)
    if (!deleted) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
