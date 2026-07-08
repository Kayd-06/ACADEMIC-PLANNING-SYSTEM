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

function getSchoolId(session: any): string | null {
  const schoolId = session?.user?.schoolId
  if (!schoolId || schoolId === 'null' || schoolId === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
    return null
  }
  return schoolId
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = session.user.email!.toLowerCase()
  const schoolId = getSchoolId(session)

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
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { title, chapter, batch, subject, type, dueDate, dueTime, totalStudents, description, totalMarks } = body
    const schoolId = getSchoolId(session)

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
      description: description || '',
      totalMarks: totalMarks !== undefined ? Number(totalMarks) : 100,
      schoolId,
    }).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('ERROR IN ASSIGNMENTS POST:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { id, title, chapter, batch, subject, type, dueDate, dueTime, status, submittedCount, fileUrl, description, totalMarks } = body
    const schoolId = getSchoolId(session)

    if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

    const updateFields: Record<string, any> = { updatedAt: new Date() }
    if (title !== undefined) updateFields.title = title
    if (chapter !== undefined) updateFields.chapter = chapter
    if (batch !== undefined) updateFields.batch = batch
    if (subject !== undefined) updateFields.subject = subject
    if (type !== undefined) updateFields.type = type
    if (dueDate !== undefined) updateFields.dueDate = dueDate
    if (dueTime !== undefined) updateFields.dueTime = dueTime
    if (status !== undefined) updateFields.status = status
    if (submittedCount !== undefined) updateFields.submittedCount = Number(submittedCount)
    if (fileUrl !== undefined) updateFields.fileUrl = fileUrl
    if (description !== undefined) updateFields.description = description
    if (totalMarks !== undefined) updateFields.totalMarks = Number(totalMarks)

    const condition = schoolId ? and(eq(assignments.id, id), eq(assignments.schoolId, schoolId)) : eq(assignments.id, id)
    const [updated] = await db.update(assignments).set(updateFields).where(condition).returning()
    if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('ERROR IN ASSIGNMENTS PUT:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const schoolId = getSchoolId(session)
    if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

    const condition = schoolId ? and(eq(assignments.id, id), eq(assignments.schoolId, schoolId)) : eq(assignments.id, id)
    const [deleted] = await db.delete(assignments).where(condition).returning()
    if (!deleted) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('ERROR IN ASSIGNMENTS DELETE:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
