import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Feedback from '@/models/Feedback'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'teacher' && session.user.role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const batchFilter = searchParams.get('batch') || 'All'

    // Fetch all student-to-teacher feedback
    const query: Record<string, any> = { type: 'Student -> Teacher' }
    if (batchFilter !== 'All') {
      query.batch = batchFilter
    }

    const allItems = await Feedback.find({ type: 'Student -> Teacher' }).lean()
    const filteredItems = await Feedback.find(query).sort({ createdAt: -1 }).lean()

    // 1. Total Feedback
    const totalFeedback = allItems.length

    // 2. Average Rating
    const avgRating = totalFeedback > 0
      ? Number((allItems.reduce((sum, item) => sum + item.rating, 0) / totalFeedback).toFixed(1))
      : 4.8

    // 3. Rating Distribution
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    allItems.forEach((item: any) => {
      const r = Math.round(item.rating) as 5 | 4 | 3 | 2 | 1
      if (distribution[r] !== undefined) {
        distribution[r]++
      }
    })

    // 4. Monthly metrics
    const now = new Date()
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

    const thisMonthFeedback = allItems.filter((item: any) => item.date && item.date.startsWith(thisMonthStr)).length
    const lastMonthFeedback = allItems.filter((item: any) => item.date && item.date.startsWith(lastMonthStr)).length

    let thisMonthChange = '+0%'
    if (lastMonthFeedback > 0) {
      const change = ((thisMonthFeedback - lastMonthFeedback) / lastMonthFeedback) * 100
      thisMonthChange = `${change >= 0 ? '+' : ''}${Math.round(change)}%`
    } else if (thisMonthFeedback > 0) {
      thisMonthChange = `+${thisMonthFeedback * 100}%`
    }

    // Get unique list of batches for filtering dropdown
    const batches = Array.from(new Set(allItems.map((item: any) => item.batch).filter(Boolean)))

    return NextResponse.json({
      totalFeedback,
      avgRating,
      ratingDistribution: distribution,
      thisMonthFeedback,
      thisMonthChange,
      feedbackList: filteredItems,
      batches
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

    await connectDB()
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 })
    }

    const updated = await Feedback.findByIdAndUpdate(id, { status: 'Resolved' }, { new: true })
    if (!updated) {
      return NextResponse.json({ error: 'Feedback record not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
