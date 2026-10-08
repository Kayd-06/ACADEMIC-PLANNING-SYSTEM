import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentRequirements } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import { errorResponse, pickAllowed } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'
import { auditAfterResponse, requireRecruitmentAccess } from '@/lib/recruitment/access'
import { resolveRequestedSchool } from '@/lib/tenantAccess'

export const dynamic = 'force-dynamic'

// Only these columns can be changed through PATCH (no id/schoolId/timestamps).
const EDITABLE = [
  'jobTitle', 'subjectProgram', 'department', 'experienceRequired', 'qualificationRequired',
  'vacancies', 'status', 'postingDate', 'closingDate',
] as const

function toApi(r: typeof recruitmentRequirements.$inferSelect) {
  return { ...r, _id: r.id, title: r.jobTitle }
}

export async function GET() {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const rows = await db.select().from(recruitmentRequirements)
      .where(inArray(recruitmentRequirements.schoolId, schoolIds))
      .orderBy(desc(recruitmentRequirements.createdAt))
    return NextResponse.json(rows.map(toApi))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/requirements', { fallbackMessage: 'Failed to fetch requirements' })
  }
}

export async function POST(req: Request) {
  try {
    const { session } = await requireRecruitmentAccess()
    const body = await req.json()
    const {
      jobTitle = '',
      title = '',
      subjectProgram = '',
      department = 'SCIENCE',
      experienceRequired = '3+ Years',
      qualificationRequired = 'Master\'s Degree',
      vacancies = 1,
      status = 'Open',
      postingDate = '',
      closingDate = '',
    } = body
    // Body schoolId may only pick another school this admin manages.
    const schoolId = await resolveRequestedSchool(session, body.schoolId)

    const finalTitle = jobTitle || title || 'Untitled Role'

    const [newReq] = await db.insert(recruitmentRequirements).values({
      jobTitle: finalTitle,
      subjectProgram: subjectProgram || finalTitle,
      department,
      experienceRequired,
      qualificationRequired,
      vacancies: Number(vacancies) || 1,
      status,
      postingDate: postingDate || new Date().toISOString().split('T')[0],
      closingDate: closingDate || '',
      schoolId,
    }).returning()

    auditAfterResponse(session, req, {
      userActionType: 'CREATE_REQUIREMENT',
      tableName: 'recruitment_requirements',
      recordId: newReq.id,
      newValues: newReq,
      schoolId,
    })
    runAfterResponse('requirement-created', () => notifyRoleInSchool(['teacher', 'management'], schoolId, {
      category: 'General',
      title: `New Job Requirement: ${newReq.jobTitle}`,
      message: `Vacancies: ${newReq.vacancies} in ${newReq.department} department.`,
      link: '/management/recruitment',
    }))

    return NextResponse.json(toApi(newReq), { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/recruitment/requirements', { fallbackMessage: 'Failed to create requirement' })
  }
}

export async function PATCH(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const targetId = body.id || body._id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const inScope = and(eq(recruitmentRequirements.id, targetId), inArray(recruitmentRequirements.schoolId, schoolIds))
    const [oldReq] = await db.select().from(recruitmentRequirements).where(inScope)
    if (!oldReq) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })

    const updates: Record<string, unknown> = pickAllowed(body, EDITABLE)
    if (updates.vacancies !== undefined) updates.vacancies = Number(updates.vacancies) || 1

    const [updatedReq] = await db.update(recruitmentRequirements).set({
      ...updates,
      jobTitle: (updates.jobTitle as string) || body.title || oldReq.jobTitle,
      updatedAt: new Date(),
    }).where(inScope).returning()

    auditAfterResponse(session, req, {
      userActionType: 'UPDATE_REQUIREMENT',
      tableName: 'recruitment_requirements',
      recordId: updatedReq.id,
      oldValues: oldReq,
      newValues: updatedReq,
      schoolId: updatedReq.schoolId,
    })
    runAfterResponse('requirement-updated', () => notifyRoleInSchool(['teacher', 'management'], updatedReq.schoolId, {
      category: 'General',
      title: `Job Requirement Updated: ${updatedReq.jobTitle}`,
      message: `Status: ${updatedReq.status}, Vacancies: ${updatedReq.vacancies}.`,
      link: '/management/recruitment',
    }))

    return NextResponse.json(toApi(updatedReq))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/recruitment/requirements', { fallbackMessage: 'Failed to update requirement' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldReq] = await db.delete(recruitmentRequirements)
      .where(and(eq(recruitmentRequirements.id, id), inArray(recruitmentRequirements.schoolId, schoolIds)))
      .returning()
    if (oldReq) {
      auditAfterResponse(session, req, {
        userActionType: 'DELETE_REQUIREMENT',
        tableName: 'recruitment_requirements',
        recordId: id,
        oldValues: oldReq,
        schoolId: oldReq.schoolId,
      })
      runAfterResponse('requirement-deleted', () => notifyRoleInSchool(['teacher', 'management'], oldReq.schoolId, {
        category: 'General',
        title: `Job Requirement Closed: ${oldReq.jobTitle}`,
        message: `The job opening for ${oldReq.jobTitle} has been closed.`,
        link: '/management/recruitment',
      }))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/recruitment/requirements', { fallbackMessage: 'Failed to delete requirement' })
  }
}
