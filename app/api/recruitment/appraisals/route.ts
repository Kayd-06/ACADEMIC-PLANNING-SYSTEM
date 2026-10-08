import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { teacherAppraisals } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { errorResponse, pickAllowed } from '@/lib/api/http'
import { auditAfterResponse, requireRecruitmentAccess } from '@/lib/recruitment/access'
import { resolveRequestedSchool } from '@/lib/tenantAccess'

export const dynamic = 'force-dynamic'

const EDITABLE = [
  'teacherName', 'teacherEmail', 'department', 'appraiserName', 'period', 'academicYear',
  'teachingRating', 'punctualityRating', 'studentFeedbackAverage', 'overallRating',
  'remarksGoals', 'improvementAreas', 'reviewStatus', 'scheduledDate', 'isCompleted', 'avatarInitials',
] as const
const STRING_FIELDS = ['teachingRating', 'punctualityRating', 'studentFeedbackAverage', 'overallRating'] as const

function toApi(r: typeof teacherAppraisals.$inferSelect) {
  return { ...r, _id: r.id, status: r.reviewStatus || 'Pending' }
}

export async function GET() {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const rows = await db.select().from(teacherAppraisals)
      .where(inArray(teacherAppraisals.schoolId, schoolIds))
      .orderBy(desc(teacherAppraisals.createdAt))
    return NextResponse.json(rows.map(toApi))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/appraisals', { fallbackMessage: 'Failed to fetch appraisals' })
  }
}

export async function POST(req: Request) {
  try {
    const { session } = await requireRecruitmentAccess()
    const body = await req.json()
    const {
      teacherName = '',
      teacherEmail = '',
      department = 'Science',
      appraiserName = 'Head of Department',
      period = 'Annual',
      academicYear = '2025-2026',
      teachingRating = '5',
      punctualityRating = '5',
      studentFeedbackAverage = '4.8',
      overallRating = 'Excellent',
      remarksGoals = '',
      improvementAreas = '',
      reviewStatus = 'Pending',
      status = '',
      scheduledDate = '',
      isCompleted = false,
      avatarInitials = '',
    } = body

    if (!teacherName.trim()) {
      return NextResponse.json({ error: 'Teacher name is required' }, { status: 400 })
    }
    const schoolId = await resolveRequestedSchool(session, body.schoolId)

    const finalStatus = reviewStatus || status || 'Pending'
    const initials = avatarInitials || teacherName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'XX'

    const [newApp] = await db.insert(teacherAppraisals).values({
      teacherName: teacherName.trim(),
      teacherEmail,
      department,
      appraiserName,
      period,
      academicYear,
      teachingRating: String(teachingRating),
      punctualityRating: String(punctualityRating),
      studentFeedbackAverage: String(studentFeedbackAverage),
      overallRating: String(overallRating),
      remarksGoals,
      improvementAreas,
      reviewStatus: finalStatus,
      scheduledDate,
      isCompleted: Boolean(isCompleted),
      avatarInitials: initials,
      schoolId,
    }).returning()

    auditAfterResponse(session, req, {
      userActionType: 'CREATE_APPRAISAL',
      tableName: 'teacher_appraisals',
      recordId: newApp.id,
      newValues: newApp,
      schoolId,
    })

    return NextResponse.json(toApi(newApp), { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/recruitment/appraisals', { fallbackMessage: 'Failed to create appraisal' })
  }
}

export async function PATCH(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const targetId = body.id || body._id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const inScope = and(eq(teacherAppraisals.id, targetId), inArray(teacherAppraisals.schoolId, schoolIds))
    const [oldApp] = await db.select().from(teacherAppraisals).where(inScope)
    if (!oldApp) return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 })

    const updates: Record<string, unknown> = pickAllowed(body, EDITABLE)
    for (const f of STRING_FIELDS) if (updates[f] !== undefined) updates[f] = String(updates[f])
    if (updates.isCompleted !== undefined) updates.isCompleted = Boolean(updates.isCompleted)
    const finalStatus = (updates.reviewStatus as string) || body.status || oldApp.reviewStatus

    const [updatedApp] = await db.update(teacherAppraisals).set({
      ...updates,
      reviewStatus: finalStatus,
      updatedAt: new Date(),
    }).where(inScope).returning()

    auditAfterResponse(session, req, {
      userActionType: 'UPDATE_APPRAISAL',
      tableName: 'teacher_appraisals',
      recordId: updatedApp.id,
      oldValues: oldApp,
      newValues: updatedApp,
      schoolId: updatedApp.schoolId,
    })

    return NextResponse.json(toApi(updatedApp))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/recruitment/appraisals', { fallbackMessage: 'Failed to update appraisal' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldApp] = await db.delete(teacherAppraisals)
      .where(and(eq(teacherAppraisals.id, id), inArray(teacherAppraisals.schoolId, schoolIds)))
      .returning()
    if (oldApp) {
      auditAfterResponse(session, req, {
        userActionType: 'DELETE_APPRAISAL',
        tableName: 'teacher_appraisals',
        recordId: id,
        oldValues: oldApp,
        schoolId: oldApp.schoolId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/recruitment/appraisals', { fallbackMessage: 'Failed to delete appraisal' })
  }
}
