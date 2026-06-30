import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assignments } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

async function seedAssignments(teacherEmail: string) {
  const [{ value: cnt }] = await db.select({ value: count() }).from(assignments).where(eq(assignments.teacherEmail, teacherEmail))
  if (Number(cnt) > 0) return

  const base = [
    { title: 'Calculus Integration DPP 04', chapter: 'Chapter 5: Definite Integrals', batch: 'Grade 11-A', subject: 'Mathematics', type: 'DPP', dueDate: getRelativeDateStr(2), dueTime: '11:59 PM', submittedCount: 34, totalStudents: 40, status: 'Active' },
    { title: 'Physics Kinematics Homework', chapter: 'Chapter 2: Motion in 1D', batch: 'Grade 11-B', subject: 'Physics', type: 'Homework', dueDate: getRelativeDateStr(-1), dueTime: '11:59 PM', submittedCount: 40, totalStudents: 40, status: 'Overdue Eval' },
    { title: 'Organic Chemistry Nomenclature', chapter: 'Chapter 12: Basic Principles', batch: 'Grade 11-A', subject: 'Chemistry', type: 'DPP', dueDate: getRelativeDateStr(-3), dueTime: '11:59 PM', submittedCount: 38, totalStudents: 40, status: 'Evaluated' },
    { title: 'Trigonometric Functions DPP 01', chapter: 'Chapter 3: Trigonometry', batch: 'Grade 11-A', subject: 'Mathematics', type: 'DPP', dueDate: getRelativeDateStr(-5), dueTime: '11:59 PM', submittedCount: 40, totalStudents: 40, status: 'Evaluated' },
    { title: 'Rotational Mechanics Homework', chapter: 'Chapter 7: Rotational Motion', batch: 'Grade 11-B', subject: 'Physics', type: 'Homework', dueDate: getRelativeDateStr(4), dueTime: '11:59 PM', submittedCount: 15, totalStudents: 40, status: 'Active' },
    { title: 'Chemical Equilibrium DPP 06', chapter: 'Chapter 6: Equilibrium', batch: 'Grade 11-A', subject: 'Chemistry', type: 'DPP', dueDate: getRelativeDateStr(-8), dueTime: '11:59 PM', submittedCount: 36, totalStudents: 40, status: 'Evaluated' },
    { title: 'Limits & Derivatives Homework', chapter: 'Chapter 13: Calculus Basics', batch: 'Grade 11-B', subject: 'Mathematics', type: 'Homework', dueDate: getRelativeDateStr(-2), dueTime: '11:59 PM', submittedCount: 39, totalStudents: 40, status: 'Overdue Eval' },
    { title: 'Thermodynamics DPP 03', chapter: 'Chapter 12: Heat & Thermodynamics', batch: 'Grade 11-A', subject: 'Physics', type: 'DPP', dueDate: getRelativeDateStr(5), dueTime: '11:59 PM', submittedCount: 12, totalStudents: 40, status: 'Active' },
    { title: 'Atomic Structure DPP 02', chapter: 'Chapter 2: Structure of Atom', batch: 'Grade 11-B', subject: 'Chemistry', type: 'DPP', dueDate: getRelativeDateStr(-12), dueTime: '11:59 PM', submittedCount: 40, totalStudents: 40, status: 'Evaluated' },
    { title: 'Probability Theory Homework', chapter: 'Chapter 16: Probability', batch: 'Grade 11-A', subject: 'Mathematics', type: 'Homework', dueDate: getRelativeDateStr(6), dueTime: '11:59 PM', submittedCount: 8, totalStudents: 40, status: 'Active' },
  ]

  const subjects = ['Mathematics', 'Physics', 'Chemistry']
  const chapters = ['Chapter 1: Sets & Relations', 'Chapter 4: Quadratic Equations', 'Chapter 8: Gravitation', 'Chapter 10: Mechanical Properties of Fluids', 'Chapter 3: Classification of Elements', 'Chapter 4: Chemical Bonding']
  const batches = ['Grade 11-A', 'Grade 11-B', 'Grade 10-A', 'Grade 10-B']

  for (let i = 11; i <= 42; i++) {
    const isDPP = i % 2 === 0
    const total = batches[i % batches.length].startsWith('Grade 11') ? 60 : 65
    const subCount = Math.floor(total * (0.6 + Math.random() * 0.4))
    base.push({
      title: `${isDPP ? 'DPP' : 'Homework'} Assessment #${i}`,
      chapter: chapters[i % chapters.length],
      batch: batches[i % batches.length],
      subject: subjects[i % subjects.length],
      type: isDPP ? 'DPP' : 'Homework',
      dueDate: getRelativeDateStr(-1 * (i - 8)),
      dueTime: '11:59 PM',
      submittedCount: subCount,
      totalStudents: total,
      status: i % 5 === 0 ? 'Overdue Eval' : 'Evaluated',
    })
  }

  await db.insert(assignments).values(base.map(a => ({ ...a, teacherEmail })))
}

const STATUS_PRIORITY: Record<string, number> = { Active: 1, 'Overdue Eval': 2, Evaluated: 3 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = session.user.email!.toLowerCase()
  await seedAssignments(email)

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'All'
  const batch = searchParams.get('batch') || 'All'

  const conditions = [eq(assignments.teacherEmail, email)]
  if (type !== 'All') conditions.push(eq(assignments.type, type))
  if (batch !== 'All') conditions.push(eq(assignments.batch, batch))

  const list = await db.select().from(assignments).where(and(...conditions))

  list.sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 3
    const bp = STATUS_PRIORITY[b.status] ?? 3
    if (ap !== bp) return ap - bp
    return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  })

  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, chapter, batch, subject, type, dueDate, dueTime, totalStudents } = body

  if (!title || !chapter || !batch || !subject || !type || !dueDate) {
    return NextResponse.json({ error: 'Missing required assignment fields' }, { status: 400 })
  }

  const [created] = await db.insert(assignments).values({
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
    teacherEmail: session.user.email!.toLowerCase(),
  }).returning()

  return NextResponse.json(created, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, status, submittedCount, fileUrl } = body

  if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

  const updateFields: Record<string, any> = { updatedAt: new Date() }
  if (status !== undefined) updateFields.status = status
  if (submittedCount !== undefined) updateFields.submittedCount = Number(submittedCount)
  if (fileUrl !== undefined) updateFields.fileUrl = fileUrl

  const [updated] = await db.update(assignments).set(updateFields).where(eq(assignments.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

  const [deleted] = await db.delete(assignments).where(eq(assignments.id, id)).returning()
  if (!deleted) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
