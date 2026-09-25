import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentCandidates } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { logAuditAction } from '@/lib/audit'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(recruitmentCandidates).orderBy(desc(recruitmentCandidates.createdAt))
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id,
      status: r.workflowStatus || 'Under Review'
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch candidates' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
      schoolId = null
    } = body

    if (!name.trim()) {
      return NextResponse.json({ error: 'Candidate name is required' }, { status: 400 })
    }

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
      requirementId: requirementId || null,
      avatarInitials: initials,
      theme,
      schedule,
      schoolId: schoolId ? schoolId : null
    }).returning()

    await logAuditAction({
      userActionType: 'CREATE_CANDIDATE',
      tableName: 'recruitment_candidates',
      recordId: newCand.id,
      newValues: newCand,
      req
    })

    // Notify teachers and admins
    await notifyRoleInSchool(
      ['teacher', 'management'],
      newCand.schoolId,
      {
        category: 'General',
        title: `New Candidate: ${newCand.name}`,
        message: `Candidate ${newCand.name} applied for role: ${newCand.roleApplied} (${newCand.department}).`,
        link: '/management/recruitment',
      }
    )

    return NextResponse.json({ ...newCand, _id: newCand.id, status: newCand.workflowStatus }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create candidate' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, _id, status, ...updates } = body
    const targetId = id || _id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldCand] = await db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, targetId))
    if (!oldCand) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

    const finalStatus = updates.workflowStatus || status || oldCand.workflowStatus
    if ('schoolId' in updates) {
      updates.schoolId = updates.schoolId ? updates.schoolId : null
    }
    if ('requirementId' in updates) {
      updates.requirementId = updates.requirementId ? updates.requirementId : null
    }
    if ('appliedDate' in updates && !updates.appliedDate) {
      delete updates.appliedDate
    }

    const [updatedCand] = await db.update(recruitmentCandidates).set({
      ...updates,
      workflowStatus: finalStatus,
      updatedAt: new Date()
    }).where(eq(recruitmentCandidates.id, targetId)).returning()

    await logAuditAction({
      userActionType: 'UPDATE_CANDIDATE',
      tableName: 'recruitment_candidates',
      recordId: updatedCand.id,
      oldValues: oldCand,
      newValues: updatedCand,
      req
    })

    // Notify teachers and admins
    await notifyRoleInSchool(
      ['teacher', 'management'],
      updatedCand.schoolId,
      {
        category: 'General',
        title: `Candidate Status Updated: ${updatedCand.name}`,
        message: `Candidate ${updatedCand.name}'s status has been updated to: ${updatedCand.workflowStatus}.`,
        link: '/management/recruitment',
      }
    )

    return NextResponse.json({ ...updatedCand, _id: updatedCand.id, status: updatedCand.workflowStatus })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update candidate' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldCand] = await db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, id))
    if (oldCand) {
      await db.delete(recruitmentCandidates).where(eq(recruitmentCandidates.id, id))
      await logAuditAction({
        userActionType: 'DELETE_CANDIDATE',
        tableName: 'recruitment_candidates',
        recordId: id,
        oldValues: oldCand,
        req
      })
      // Notify teachers and admins
      await notifyRoleInSchool(
        ['teacher', 'management'],
        oldCand.schoolId,
        {
          category: 'General',
          title: `Candidate Removed: ${oldCand.name}`,
          message: `Candidate ${oldCand.name} (Role: ${oldCand.roleApplied}) has been deleted from recruitment records.`,
          link: '/management/recruitment',
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete candidate' }, { status: 500 })
  }
}
