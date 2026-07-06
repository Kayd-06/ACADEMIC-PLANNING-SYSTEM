import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recruitmentRequirements } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(recruitmentRequirements).orderBy(desc(recruitmentRequirements.createdAt))
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id,
      title: r.jobTitle
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch requirements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
      closingDate = ''
    } = body

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
      closingDate: closingDate || ''
    }).returning()

    await logAuditAction({
      userActionType: 'CREATE_REQUIREMENT',
      tableName: 'recruitment_requirements',
      recordId: newReq.id,
      newValues: newReq,
      req
    })

    return NextResponse.json({ ...newReq, _id: newReq.id, title: newReq.jobTitle }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create requirement' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, _id, ...updates } = body
    const targetId = id || _id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldReq] = await db.select().from(recruitmentRequirements).where(eq(recruitmentRequirements.id, targetId))
    if (!oldReq) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })

    const [updatedReq] = await db.update(recruitmentRequirements).set({
      ...updates,
      jobTitle: updates.jobTitle || updates.title || oldReq.jobTitle,
      updatedAt: new Date()
    }).where(eq(recruitmentRequirements.id, targetId)).returning()

    await logAuditAction({
      userActionType: 'UPDATE_REQUIREMENT',
      tableName: 'recruitment_requirements',
      recordId: updatedReq.id,
      oldValues: oldReq,
      newValues: updatedReq,
      req
    })

    return NextResponse.json({ ...updatedReq, _id: updatedReq.id, title: updatedReq.jobTitle })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update requirement' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldReq] = await db.select().from(recruitmentRequirements).where(eq(recruitmentRequirements.id, id))
    if (oldReq) {
      await db.delete(recruitmentRequirements).where(eq(recruitmentRequirements.id, id))
      await logAuditAction({
        userActionType: 'DELETE_REQUIREMENT',
        tableName: 'recruitment_requirements',
        recordId: id,
        oldValues: oldReq,
        req
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete requirement' }, { status: 500 })
  }
}
