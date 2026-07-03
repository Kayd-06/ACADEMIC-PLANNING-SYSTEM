import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getRelativeDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

async function seedFeedback(schoolId: string | null) {
  const conditions = schoolId ? [eq(feedback.schoolId, schoolId)] : []
  const [{ value: cnt }] = conditions.length
    ? await db.select({ value: count() }).from(feedback).where(and(...conditions))
    : await db.select({ value: count() }).from(feedback)
  if (Number(cnt) > 0) return

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
    ...Array(9).fill('In Progress'),
    ...Array(70).fill('Resolved'),
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

const STATUS_PRIORITY: Record<string, number> = { Submitted: 1, 'In Progress': 2, Resolved: 3, Dismissed: 4 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
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
  const pendingCount = allItems.filter(i => i.status === 'Submitted' || i.status === 'In Progress').length
  const actionedCount = allItems.filter(i => i.status === 'Resolved' || i.status === 'Dismissed').length

  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  allItems.forEach(i => { const r = Math.round(i.rating); if (distribution[r] !== undefined) distribution[r]++ })
  const ratingDistribution = Object.fromEntries(
    Object.entries(distribution).map(([k, v]) => [k, totalCount > 0 ? Math.round((v / totalCount) * 100) : 0])
  )

  let filtered = allItems
  if (type !== 'All') filtered = filtered.filter(i => i.type === type)
  if (view === 'actioned') {
    filtered = filtered.filter(i => i.status === 'Resolved' || i.status === 'Dismissed' || i.status === 'In Progress')
  } else {
    filtered = filtered.filter(i => i.status === 'Submitted' || i.status === 'In Progress')
  }

  filtered.sort((a, b) => {
    const ap = STATUS_PRIORITY[a.status] ?? 4
    const bp = STATUS_PRIORITY[b.status] ?? 4
    if (ap !== bp) return ap - bp
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  return NextResponse.json({ totalCount, avgRating, pendingCount, actionedCount, ratingDistribution, feedbackList: filtered })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  const body = await req.json()
  const { id, status } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  const condition = schoolId ? and(eq(feedback.id, id), eq(feedback.schoolId, schoolId)) : eq(feedback.id, id)
  const [updated] = await db.update(feedback).set({ status, updatedAt: new Date() }).where(condition).returning()
  if (!updated) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })

  return NextResponse.json(updated)
}
