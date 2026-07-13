import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentInterviews } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { logAuditAction } from '@/lib/audit'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const candidateId = url.searchParams.get('candidateId')

    let query = db.select().from(recruitmentInterviews).orderBy(desc(recruitmentInterviews.createdAt))
    if (candidateId) {
      query = db.select().from(recruitmentInterviews).where(eq(recruitmentInterviews.candidateId, candidateId)).orderBy(desc(recruitmentInterviews.createdAt)) as any
    }

    const rows = await query
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch interviews' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      candidateId = null,
      candidateName = '',
      dateTime = '',
      mode = 'In-person',
      locationOrLink = '',
      feedbackText = '',
      rating = 3,
      finalResult = 'Pending',
      interviewerName = 'Panel'
    } = body

    const [newInt] = await db.insert(recruitmentInterviews).values({
      candidateId: candidateId || null,
      candidateName: candidateName || 'Unknown Candidate',
      dateTime: dateTime || new Date().toISOString(),
      mode,
      locationOrLink,
      feedbackText,
      rating: Number(rating) || 3,
      finalResult,
      interviewerName
    }).returning()

    await logAuditAction({
      userActionType: 'CREATE_INTERVIEW',
      tableName: 'recruitment_interviews',
      recordId: newInt.id,
      newValues: newInt,
      req
    })

    // Notify teachers and admins 24 hours prior
    const eventTime = new Date(newInt.dateTime)
    const notifyTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      null,
      {
        category: 'General',
        title: `Upcoming Interview: ${newInt.candidateName}`,
        message: `Interview scheduled on ${new Date(newInt.dateTime).toLocaleString()} (${newInt.mode}) with Interviewer: ${newInt.interviewerName}.`,
        createdAt: notifyTime,
        link: '/management/recruitment',
      }
    )

    return NextResponse.json({ ...newInt, _id: newInt.id }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create interview' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, _id, ...updates } = body
    const targetId = id || _id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldInt] = await db.select().from(recruitmentInterviews).where(eq(recruitmentInterviews.id, targetId))
    if (!oldInt) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

    const [updatedInt] = await db.update(recruitmentInterviews).set({
      ...updates,
      rating: updates.rating !== undefined ? Number(updates.rating) : oldInt.rating,
      updatedAt: new Date()
    }).where(eq(recruitmentInterviews.id, targetId)).returning()

    await logAuditAction({
      userActionType: 'UPDATE_INTERVIEW',
      tableName: 'recruitment_interviews',
      recordId: updatedInt.id,
      oldValues: oldInt,
      newValues: updatedInt,
      req
    })

    // Notify teachers and admins 24 hours prior
    const eventTime = new Date(updatedInt.dateTime)
    const notifyTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000)
    await notifyRoleInSchool(
      ['teacher', 'management'],
      null,
      {
        category: 'General',
        title: `Interview Updated: ${updatedInt.candidateName}`,
        message: `Interview schedule updated: ${new Date(updatedInt.dateTime).toLocaleString()} (${updatedInt.mode}).`,
        createdAt: notifyTime,
        link: '/management/recruitment',
      }
    )

    return NextResponse.json({ ...updatedInt, _id: updatedInt.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update interview' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldInt] = await db.select().from(recruitmentInterviews).where(eq(recruitmentInterviews.id, id))
    if (oldInt) {
      await db.delete(recruitmentInterviews).where(eq(recruitmentInterviews.id, id))
      await logAuditAction({
        userActionType: 'DELETE_INTERVIEW',
        tableName: 'recruitment_interviews',
        recordId: id,
        oldValues: oldInt,
        req
      })
      // Notify teachers and admins immediately
      await notifyRoleInSchool(
        ['teacher', 'management'],
        null,
        {
          category: 'General',
          title: `Interview Cancelled: ${oldInt.candidateName}`,
          message: `The interview scheduled for ${new Date(oldInt.dateTime).toLocaleString()} has been cancelled.`,
          link: '/management/recruitment',
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete interview' }, { status: 500 })
  }
}
