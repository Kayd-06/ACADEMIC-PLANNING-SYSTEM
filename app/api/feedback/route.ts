import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { eq, and, count, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// Interaction flows per spec
const FLOW_TYPES = ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management', 'Management -> Teacher']
// Process statuses per spec
const PROCESS_STATUSES = ['Submitted', 'Reviewed', 'Actioned', 'Dismissed']

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

async function seedFeedback(schoolId: string | null) {
  // Only seed once for a completely empty table — skip if any feedback exists across all schools
  const [{ value: totalCnt }] = await db.select({ value: count() }).from(feedback)
  if (Number(totalCnt) > 0) return

  const contents = {
    'Student -> Teacher': [
      "The weekly tests are really helpful. The explanation of doubts after tests could be a bit more detailed.",
      "Organic Chemistry chapters are being covered very quickly. Please slow down the mechanism explanation.",
      "Really appreciate the extra handouts provided for JEE Physics. They have extremely good problem sets.",
      "The digital whiteboard notes are sometimes not uploaded on time. Please post them right after class.",
      "Mathematics lectures are outstanding. The interactive graphs make complex concepts easy to understand.",
      "Can we have more assignments on integration? The textbook questions are not enough for practice.",
    ],
    'Parent -> School': [
      "The new laboratory equipment is impressive. My child is excited about practical classes.",
      "The canteen food options should include more healthy fruits and less packaged snacks.",
      "The parent-teacher meeting was very well organized. Clear feedback on student strengths was given.",
      "School bus route #4 is frequently late by 10-15 minutes in the morning. Please look into it.",
      "The library lacks sufficient copies of standard JEE reference books. Please purchase more copies.",
      "Communication through the portal has improved a lot. We get alerts instantly now.",
    ],
    'Teacher -> Management': [
      "The classroom projector in Block B, Room 204 is flickering. It makes teaching difficult.",
      "Requesting additional markers and whiteboards for the secondary school teacher room.",
      "The syllabus progress tracking tool is very smooth and makes academic planning clean.",
      "Suggesting a small workshop on digital tools usage for secondary faculty members.",
      "Could we optimize the duty schedules during examinations to allow teachers grading breaks?",
      "Excellent explanation of molecular structures. The 3D models were beautiful.",
    ],
  }
  const types = ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management'] as const
  const subjects = ['Physics', 'Chemistry', 'Mathematics', 'English', 'Biology']
  const batches = ['Grade 9-A', 'Grade 12-B', 'Grade 11-A', 'Grade 10-B']
  const categories = ['Transport', 'Canteen', 'Library', 'Hostel', 'Academics', 'Infrastructure']
  const names = ['Amit Sharma', 'Neha Patel', 'Rohan Gupta', 'Karan Verma', 'Sanjay Shah', 'Deepa Nair', 'Rahul Das', 'Anjali Sen', 'Vijay Reddy']
  const statuses = [
    ...Array(9).fill('Submitted'),
    ...Array(9).fill('Reviewed'),
    ...Array(70).fill('Actioned'),
    ...Array(36).fill('Dismissed'),
  ]
  const ratings = [
    ...Array(52).fill(5), ...Array(41).fill(4), ...Array(21).fill(3), ...Array(10).fill(2), ...Array(0).fill(1),
  ]

  const rows: any[] = []
  for (let i = 0; i < 124; i++) {
    const type = types[i % 3]
    const status = statuses[i % statuses.length]
    const rating = ratings[i % ratings.length]
    const textPool = contents[type]
    const content = textPool[i % textPool.length]
    const isAnon = type === 'Student -> Teacher' && i % 3 === 0
    const senderName = isAnon ? 'Anonymous' : names[i % names.length]
    const row: Record<string, any> = {
      senderName, isAnonymous: isAnon, rating, content, type, status,
      date: getRelativeDateStr(-1 - Math.floor(i / 4)),
      schoolId,
    }
    if (type === 'Student -> Teacher') {
      row.subject = subjects[i % subjects.length]
      row.batch = batches[i % batches.length]
    } else {
      row.category = categories[i % categories.length]
    }
    rows.push(row)
  }

  await db.insert(feedback).values(rows)
}

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
    return NextResponse.json({
      received: items.filter(i => i.type === 'Management -> Teacher'),
      sent: items.filter(i => i.type === 'Teacher -> Management'),
    })
  }

  if (role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await seedFeedback(schoolId)

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
    await notifyRoleInSchool(['teacher'], schoolId, {
      category: 'General',
      title: 'New feedback from management',
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
