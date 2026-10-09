import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentCandidates, recruitmentRequirements } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import { errorResponse, HttpError, pickAllowed } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'
import { auditAfterResponse, requireRecruitmentAccess } from '@/lib/recruitment/access'
import { resolveRequestedSchool } from '@/lib/tenantAccess'

export const dynamic = 'force-dynamic'

const EDITABLE = [
  'name', 'contactEmail', 'contactPhone', 'qualification', 'resumeLink', 'yearsOfExperience',
  'currentOrganization', 'specialization', 'expectedSalary', 'appliedDate', 'workflowStatus',
  'roleApplied', 'department', 'requirementId', 'avatarInitials', 'theme', 'schedule',
] as const

function toApi(r: typeof recruitmentCandidates.$inferSelect) {
  return { ...r, _id: r.id, status: r.workflowStatus || 'Under Review' }
}

// A candidate may only be linked to a requirement in a school the admin manages.
async function assertRequirementInScope(requirementId: unknown, schoolIds: string[]) {
  if (!requirementId) return null
  const [row] = await db.select({ id: recruitmentRequirements.id }).from(recruitmentRequirements)
    .where(and(eq(recruitmentRequirements.id, String(requirementId)), inArray(recruitmentRequirements.schoolId, schoolIds)))
  if (!row) throw new HttpError(400, 'Requirement not found')
  return row.id
}

export async function GET() {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const rows = await db.select().from(recruitmentCandidates)
      .where(inArray(recruitmentCandidates.schoolId, schoolIds))
      .orderBy(desc(recruitmentCandidates.createdAt))
    return NextResponse.json(rows.map(toApi))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/candidates', { fallbackMessage: 'Failed to fetch candidates' })
  }
}

export async function POST(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const {
      name = '',
      contactEmail = '',
      contactPhone = '',
      qualification = '',
      resumeLink = '',
      yearsOfExperience = '0',
      currentOrganization = '',
      specialization = '',
      expectedSalary = '',
      appliedDate = '',
      workflowStatus = '',
      status = '',
      roleApplied = '',
      department = 'SCIENCE',
      requirementId = null,
      avatarInitials = '',
      theme = 'blue',
      schedule = '',
    } = body

    if (!name.trim()) {
      return NextResponse.json({ error: 'Candidate name is required' }, { status: 400 })
    }
    const schoolId = await resolveRequestedSchool(session, body.schoolId)
    const linkedRequirementId = await assertRequirementInScope(requirementId, schoolIds)

    const finalStatus = workflowStatus || status || 'Requirement'
    const initials = avatarInitials || name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'XX'
    const finalDate = appliedDate || new Date().toISOString().split('T')[0]

    const [newCand] = await db.insert(recruitmentCandidates).values({
      name: name.trim(),
      contactEmail,
      contactPhone,
      qualification,
      resumeLink,
      yearsOfExperience: String(yearsOfExperience),
      currentOrganization,
      specialization,
      expectedSalary,
      appliedDate: finalDate,
      workflowStatus: finalStatus,
      roleApplied: roleApplied || 'General Candidate',
      department,
      requirementId: linkedRequirementId,
      avatarInitials: initials,
      theme,
      schedule,
      schoolId,
    }).returning()

    auditAfterResponse(session, req, {
      userActionType: 'CREATE_CANDIDATE',
      tableName: 'recruitment_candidates',
      recordId: newCand.id,
      newValues: newCand,
      schoolId,
    })
    runAfterResponse('candidate-created', () => notifyRoleInSchool(['teacher', 'management'], schoolId, {
      category: 'General',
      title: `New Candidate: ${newCand.name}`,
      message: `Candidate ${newCand.name} applied for role: ${newCand.roleApplied} (${newCand.department}).`,
      link: '/management/recruitment',
    }))

    return NextResponse.json(toApi(newCand), { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/recruitment/candidates', { fallbackMessage: 'Failed to create candidate' })
  }
}

export async function PATCH(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const targetId = body.id || body._id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const inScope = and(eq(recruitmentCandidates.id, targetId), inArray(recruitmentCandidates.schoolId, schoolIds))
    const [oldCand] = await db.select().from(recruitmentCandidates).where(inScope)
    if (!oldCand) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

    const updates: Record<string, unknown> = pickAllowed(body, EDITABLE)
    const finalStatus = (updates.workflowStatus as string) || body.status || oldCand.workflowStatus
    if ('requirementId' in updates) {
      updates.requirementId = await assertRequirementInScope(updates.requirementId, schoolIds)
    }
    if ('appliedDate' in updates && !updates.appliedDate) delete updates.appliedDate
    if (updates.yearsOfExperience !== undefined) updates.yearsOfExperience = String(updates.yearsOfExperience)
    // Moving a candidate to another school is allowed only between schools this admin manages.
    if ('schoolId' in body) updates.schoolId = await resolveRequestedSchool(session, body.schoolId)

    const [updatedCand] = await db.update(recruitmentCandidates).set({
      ...updates,
      workflowStatus: finalStatus,
      updatedAt: new Date(),
    }).where(inScope).returning()

    auditAfterResponse(session, req, {
      userActionType: 'UPDATE_CANDIDATE',
      tableName: 'recruitment_candidates',
      recordId: updatedCand.id,
      oldValues: oldCand,
      newValues: updatedCand,
      schoolId: updatedCand.schoolId,
    })
    runAfterResponse('candidate-updated', () => notifyRoleInSchool(['teacher', 'management'], updatedCand.schoolId, {
      category: 'General',
      title: `Candidate Status Updated: ${updatedCand.name}`,
      message: `Candidate ${updatedCand.name}'s status has been updated to: ${updatedCand.workflowStatus}.`,
      link: '/management/recruitment',
    }))

    return NextResponse.json(toApi(updatedCand))
  } catch (error) {
    return errorResponse(error, 'PATCH /api/recruitment/candidates', { fallbackMessage: 'Failed to update candidate' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { session, schoolIds } = await requireRecruitmentAccess()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldCand] = await db.delete(recruitmentCandidates)
      .where(and(eq(recruitmentCandidates.id, id), inArray(recruitmentCandidates.schoolId, schoolIds)))
      .returning()
    if (oldCand) {
      auditAfterResponse(session, req, {
        userActionType: 'DELETE_CANDIDATE',
        tableName: 'recruitment_candidates',
        recordId: id,
        oldValues: oldCand,
        schoolId: oldCand.schoolId,
      })
      runAfterResponse('candidate-deleted', () => notifyRoleInSchool(['teacher', 'management'], oldCand.schoolId, {
        category: 'General',
        title: `Candidate Removed: ${oldCand.name}`,
        message: `Candidate ${oldCand.name} (Role: ${oldCand.roleApplied}) has been deleted from recruitment records.`,
        link: '/management/recruitment',
      }))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/recruitment/candidates', { fallbackMessage: 'Failed to delete candidate' })
  }
}
