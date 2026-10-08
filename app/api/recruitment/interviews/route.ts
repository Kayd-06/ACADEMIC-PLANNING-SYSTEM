import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentCandidates, recruitmentInterviews } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import { formatDateTime } from '@/lib/date'
import { errorResponse, HttpError, pickAllowed } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'
import { auditAfterResponse, requireRecruitmentAccess } from '@/lib/recruitment/access'
import { resolveRequestedSchool } from '@/lib/tenantAccess'

export const dynamic = 'force-dynamic'

const EDITABLE = [
  'candidateId', 'candidateName', 'dateTime', 'mode', 'locationOrLink',
  'feedbackText', 'rating', 'finalResult', 'interviewerName',
] as const

async function assertCandidateInScope(candidateId: unknown, schoolIds: string[]) {
  if (!candidateId) return null
  const [row] = await db.select({ id: recruitmentCandidates.id }).from(recruitmentCandidates)
    .where(and(eq(recruitmentCandidates.id, String(candidateId)), inArray(recruitmentCandidates.schoolId, schoolIds)))
  if (!row) throw new HttpError(400, 'Candidate not found')
  return row.id
}

function dayBefore(dateTime: string) {
  const t = new Date(dateTime).getTime()
  return isNaN(t) ? new Date() : new Date(t - 24 * 60 * 60 * 1000)
}

export async function GET(req: Request) {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const candidateId = new URL(req.url).searchParams.get('candidateId')

    const conditions = [inArray(recruitmentInterviews.schoolId, schoolIds)]
    if (candidateId) conditions.push(eq(recruitmentInterviews.candidateId, candidateId))
    const rows = await db.select().from(recruitmentInterviews)
      .where(and(...conditions))
      .orderBy(desc(recruitmentInterviews.createdAt))
    return NextResponse.json(rows.map(r => ({ ...r, _id: r.id })))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/interviews', { fallbackMessage: 'Failed to fetch interviews' })
  }
}

export async function POST(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
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
      interviewerName = 'Panel',
    } = body
    const schoolId = await resolveRequestedSchool(session, body.schoolId)
    const linkedCandidateId = await assertCandidateInScope(candidateId, schoolIds)

    const [newInt] = await db.insert(recruitmentInterviews).values({
      candidateId: linkedCandidateId,
      candidateName: candidateName || 'Unknown Candidate',
      dateTime: dateTime || new Date().toISOString(),
      mode,
      locationOrLink,
      feedbackText,
      rating: Number(rating) || 3,
      finalResult,
      interviewerName,
      schoolId,
    }).returning()

    auditAfterResponse(session, req, {
      userActionType: 'CREATE_INTERVIEW',
      tableName: 'recruitment_interviews',
      recordId: newInt.id,
      newValues: newInt,
      schoolId,
    })
    // Used to notify with schoolId = null, i.e. every school's staff.
    runAfterResponse('interview-created', () => notifyRoleInSchool(['teacher', 'management'], schoolId, {
      category: 'General',
      title: `Upcoming Interview: ${newInt.candidateName}`,
      message: `Interview scheduled on ${formatDateTime(newInt.dateTime)} (${newInt.mode}) with Interviewer: ${newInt.interviewerName}.`,
      createdAt: dayBefore(newInt.dateTime),
      link: '/management/recruitment',
    }))

    return NextResponse.json({ ...newInt, _id: newInt.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/recruitment/interviews', { fallbackMessage: 'Failed to create interview' })
  }
}

export async function PATCH(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const targetId = body.id || body._id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const inScope = and(eq(recruitmentInterviews.id, targetId), inArray(recruitmentInterviews.schoolId, schoolIds))
    const [oldInt] = await db.select().from(recruitmentInterviews).where(inScope)
    if (!oldInt) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

    const updates: Record<string, unknown> = pickAllowed(body, EDITABLE)
    if ('candidateId' in updates) updates.candidateId = await assertCandidateInScope(updates.candidateId, schoolIds)

    const [updatedInt] = await db.update(recruitmentInterviews).set({
      ...updates,
      rating: updates.rating !== undefined ? Number(updates.rating) : oldInt.rating,
      updatedAt: new Date(),
    }).where(inScope).returning()

    auditAfterResponse(session, req, {
      userActionType: 'UPDATE_INTERVIEW',
      tableName: 'recruitment_interviews',
      recordId: updatedInt.id,
      oldValues: oldInt,
      newValues: updatedInt,
      schoolId: updatedInt.schoolId,
    })
    runAfterResponse('interview-updated', () => notifyRoleInSchool(['teacher', 'management'], updatedInt.schoolId, {
      category: 'General',
      title: `Interview Updated: ${updatedInt.candidateName}`,
      message: `Interview schedule updated: ${formatDateTime(updatedInt.dateTime)} (${updatedInt.mode}).`,
      createdAt: dayBefore(updatedInt.dateTime),
      link: '/management/recruitment',
    }))

    return NextResponse.json({ ...updatedInt, _id: updatedInt.id })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/recruitment/interviews', { fallbackMessage: 'Failed to update interview' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldInt] = await db.delete(recruitmentInterviews)
      .where(and(eq(recruitmentInterviews.id, id), inArray(recruitmentInterviews.schoolId, schoolIds)))
      .returning()
    if (oldInt) {
      auditAfterResponse(session, req, {
        userActionType: 'DELETE_INTERVIEW',
        tableName: 'recruitment_interviews',
        recordId: id,
        oldValues: oldInt,
        schoolId: oldInt.schoolId,
      })
      runAfterResponse('interview-deleted', () => notifyRoleInSchool(['teacher', 'management'], oldInt.schoolId, {
        category: 'General',
        title: `Interview Cancelled: ${oldInt.candidateName}`,
        message: `The interview scheduled for ${formatDateTime(oldInt.dateTime)} has been cancelled.`,
        link: '/management/recruitment',
      }))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/recruitment/interviews', { fallbackMessage: 'Failed to delete interview' })
  }
}
