import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// Interaction flows per spec
const FLOW_TYPES = ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management', 'Management -> Teacher']
// Process statuses per spec
const PROCESS_STATUSES = ['Submitted', 'Reviewed', 'Actioned', 'Dismissed']

const STATUS_PRIORITY: Record<string, number> = { Submitted: 1, Reviewed: 2, Actioned: 3, Dismissed: 4 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  const schoolId = (session.user as any).schoolId as string | null

  // Teachers see the flows that involve them: feedback they sent up, and feedback sent to them
  if (role === 'teacher') {
    const teacherTypes = ['Management -> Teacher', 'Teacher -> Management']
    const conditions = [inArray(feedback.type, teacherTypes)]
    if (schoolId) conditions.push(eq(feedback.schoolId, schoolId))
    const items = await db.select().from(feedback).where(and(...conditions))
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const teacherName = session.user?.name || ''
    const teacherEmail = session.user?.email || ''
    return NextResponse.json({
      received: items.filter(i => 
        i.type === 'Management -> Teacher' && (
          !i.batch || 
          i.batch === 'All Faculty' || 
          i.batch === teacherName || 
          i.subject === teacherEmail ||
          i.batch.includes(teacherName)
        )
      ),
      sent: items.filter(i => i.type === 'Teacher -> Management'),
    })
  }

  if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'All'
  const view = searchParams.get('view') || 'pending'

  const allItems = schoolId
    ? await db.select().from(feedback).where(eq(feedback.schoolId, schoolId))
    : await db.select().from(feedback)

  const totalCount = allItems.length
  const avgRating = totalCount > 0
    ? Number((allItems.reduce((s, i) => s + i.rating, 0) / totalCount).toFixed(1))
    : 4.1
  const pendingCount = allItems.filter(i => i.status === 'Submitted' || i.status === 'Reviewed').length
  const actionedCount = allItems.filter(i => i.status === 'Actioned' || i.status === 'Dismissed').length

  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  allItems.forEach(i => { const r = Math.round(i.rating); if (distribution[r] !== undefined) distribution[r]++ })
  const ratingDistribution = Object.fromEntries(
    Object.entries(distribution).map(([k, v]) => [k, totalCount > 0 ? Math.round((v / totalCount) * 100) : 0])
  )

  let filtered = allItems
  if (type !== 'All') filtered = filtered.filter(i => i.type === type)
  if (view === 'actioned') {
    filtered = filtered.filter(i => i.status === 'Actioned' || i.status === 'Dismissed' || i.status === 'Reviewed')
  } else {
    filtered = filtered.filter(i => i.status === 'Submitted' || i.status === 'Reviewed')
  }

  filtered.sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 4
    const bp = STATUS_PRIORITY[b.status] ?? 4
    if (ap !== bp) return ap - bp
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return NextResponse.json({ totalCount, avgRating, pendingCount, actionedCount, ratingDistribution, feedbackList: filtered })
}

// POST — create feedback.
// Management sends 'Management -> Teacher'; teachers send 'Teacher -> Management'.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'management' && role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schoolId = (session.user as any).schoolId as string | null
  const body = await req.json()

  // Handle bulk upload via Excel / CSV
  if (body.action === 'bulk' && Array.isArray(body.items)) {
    const toInsert = body.items.map((i: any) => ({
      senderName: i.senderName?.trim() || 'Anonymous',
      isAnonymous: i.senderName?.toLowerCase() === 'anonymous' || !!i.isAnonymous,
      rating: typeof i.rating === 'number' && !isNaN(i.rating) && i.rating >= 1 && i.rating <= 5 ? i.rating : 5,
      content: i.content?.trim() || 'General feedback',
      type: FLOW_TYPES.includes(i.type) ? i.type : 'Student -> Teacher',
      status: 'Submitted',
      subject: i.subject?.trim() || '',
      batch: i.batch?.trim() || '',
      category: i.category?.trim() || 'Academics',
      date: i.date?.trim() || new Date().toISOString().split('T')[0],
      schoolId,
    })).filter((i: any) => i.content !== '')

    if (toInsert.length === 0) return NextResponse.json({ error: 'No valid rows to insert' }, { status: 400 })
    const created = await db.insert(feedback).values(toInsert).returning()
    return NextResponse.json({ count: created.length, created }, { status: 201 })
  }

  const { content, rating, isAnonymous, subject, batch, category } = body

  if (!content?.trim()) return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 })
  const parsedRating = Number(rating)
  if (rating !== undefined && (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const type = role === 'management' ? 'Management -> Teacher' : 'Teacher -> Management'
  const anonymous = !!isAnonymous
  const [created] = await db.insert(feedback).values({
    senderName: anonymous ? 'Anonymous' : (session.user.name ?? ''),
    isAnonymous: anonymous,
    rating: rating !== undefined ? parsedRating : 5,
    content: content.trim(),
    type,
    status: 'Submitted',
    subject: subject?.trim() || '',
    batch: batch?.trim() || '',
    category: category?.trim() || '',
    date: new Date().toISOString().split('T')[0],
    schoolId,
  }).returning()

  // Notify the receiving side's inbox
  if (type === 'Management -> Teacher') {
    const titleText = batch && batch !== 'All Faculty' 
      ? `New personalised feedback from management for ${batch}` 
      : 'New feedback from management'
    await notifyRoleInSchool(['teacher'], schoolId, {
      category: 'General',
      title: titleText,
      message: created.content.slice(0, 200),
      link: '/teacher/feedback',
    })
  } else {
    await notifyRoleInSchool(['management'], schoolId, {
      category: 'General',
      title: `New feedback from ${created.senderName || 'a teacher'}`,
      message: created.content.slice(0, 200),
      link: '/management/feedback',
    })
  }

  return NextResponse.json(created, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
  if (!PROCESS_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${PROCESS_STATUSES.join(', ')}` }, { status: 400 })
  }

  const condition = schoolId ? and(eq(feedback.id, id), eq(feedback.schoolId, schoolId)) : eq(feedback.id, id)
  const [updated] = await db.update(feedback).set({ status, updatedAt: new Date() }).where(condition).returning()
  if (!updated) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })

  return NextResponse.json(updated)
}

// DELETE — remove a feedback entry (management only)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(feedback.id, id), eq(feedback.schoolId, schoolId)) : eq(feedback.id, id)
  await db.delete(feedback).where(condition)
  return NextResponse.json({ success: true })
}
