import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { feedback } from '@/lib/db/schema'
import { isUuid, requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

// Student -> Teacher feedback stats — moved from the MongoDB Feedback
// collection to the Postgres feedback table, scoped to the session's school.
// Same response shape as before. With no feedback the average is 0 (the old
// route reported a made-up 4.8).

const TYPE = 'Student -> Teacher'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'teacher' && session.user.role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = requireSchool(session)

    const { searchParams } = new URL(req.url)
    const batchFilter = searchParams.get('batch') || 'All'

    const allItems = await db.select().from(feedback)
      .where(and(eq(feedback.schoolId, schoolId), eq(feedback.type, TYPE)))
      .orderBy(desc(feedback.createdAt))
    const filteredItems = batchFilter === 'All' ? allItems : allItems.filter((item) => item.batch === batchFilter)

    const totalFeedback = allItems.length
    const avgRating = totalFeedback > 0
      ? Number((allItems.reduce((sum, item) => sum + item.rating, 0) / totalFeedback).toFixed(1))
      : 0

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    allItems.forEach((item) => {
      const r = Math.round(item.rating) as 5 | 4 | 3 | 2 | 1
      if (distribution[r] !== undefined) distribution[r]++
    })

    const now = new Date()
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

    const thisMonthFeedback = allItems.filter((item) => item.date && item.date.startsWith(thisMonthStr)).length
    const lastMonthFeedback = allItems.filter((item) => item.date && item.date.startsWith(lastMonthStr)).length

    let thisMonthChange = '+0%'
    if (lastMonthFeedback > 0) {
      const change = ((thisMonthFeedback - lastMonthFeedback) / lastMonthFeedback) * 100
      thisMonthChange = `${change >= 0 ? '+' : ''}${Math.round(change)}%`
    } else if (thisMonthFeedback > 0) {
      thisMonthChange = `+${thisMonthFeedback * 100}%`
    }

    const batches = Array.from(new Set(allItems.map((item) => item.batch).filter(Boolean)))

    return NextResponse.json({
      totalFeedback,
      avgRating,
      ratingDistribution: distribution,
      thisMonthFeedback,
      thisMonthChange,
      feedbackList: filteredItems.map((item) => ({ ...item, _id: item.id })),
      batches,
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/teacher/feedback')
  }
}

// PUT — Acknowledge feedback (sets status to 'Resolved')
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'teacher' && session.user.role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }
    const schoolId = requireSchool(session)
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 })
    }

    const [updated] = await db.update(feedback)
      .set({ status: 'Resolved', updatedAt: new Date() })
      .where(and(eq(feedback.id, id), eq(feedback.schoolId, schoolId), eq(feedback.type, TYPE)))
      .returning()
    if (!updated) {
      return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 })
    }

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error) {
    return errorResponse(error, 'PUT /api/teacher/feedback')
  }
}
