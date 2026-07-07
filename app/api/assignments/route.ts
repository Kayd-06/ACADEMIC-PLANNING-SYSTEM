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

const STATUS_PRIORITY: Record<string, number> = { Active: 1, 'Overdue Eval': 2, Evaluated: 3 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = session.user.email!.toLowerCase()
  const schoolId = (session.user as any).schoolId as string | null

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'All'
  const batch = searchParams.get('batch') || 'All'

  const conditions = []
  if (schoolId) {
    conditions.push(eq(assignments.schoolId, schoolId))
  } else {
    conditions.push(eq(assignments.teacherEmail, email))
  }
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
  const schoolId = (session.user as any).schoolId as string | null

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
    schoolId,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, status, submittedCount, fileUrl } = body
  const schoolId = (session.user as any).schoolId as string | null

  if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

  const updateFields: Record<string, any> = { updatedAt: new Date() }
  if (status !== undefined) updateFields.status = status
  if (submittedCount !== undefined) updateFields.submittedCount = Number(submittedCount)
  if (fileUrl !== undefined) updateFields.fileUrl = fileUrl

  const condition = schoolId ? and(eq(assignments.id, id), eq(assignments.schoolId, schoolId)) : eq(assignments.id, id)
  const [updated] = await db.update(assignments).set(updateFields).where(condition).returning()
  if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const schoolId = (session.user as any).schoolId as string | null
  if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

  const condition = schoolId ? and(eq(assignments.id, id), eq(assignments.schoolId, schoolId)) : eq(assignments.id, id)
  const [deleted] = await db.delete(assignments).where(condition).returning()
  if (!deleted) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
