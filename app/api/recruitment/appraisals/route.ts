import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { teacherAppraisals } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(teacherAppraisals).orderBy(desc(teacherAppraisals.createdAt))
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id,
      status: r.reviewStatus || 'Pending'
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch appraisals' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
      avatarInitials = ''
    } = body

    if (!teacherName.trim()) {
      return NextResponse.json({ error: 'Teacher name is required' }, { status: 400 })
    }

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
      avatarInitials: initials
    }).returning()

    await logAuditAction({
      userActionType: 'CREATE_APPRAISAL',
      tableName: 'teacher_appraisals',
      recordId: newApp.id,
      newValues: newApp,
      req
    })

    return NextResponse.json({ ...newApp, _id: newApp.id, status: newApp.reviewStatus }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create appraisal' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, _id, status, ...updates } = body
    const targetId = id || _id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldApp] = await db.select().from(teacherAppraisals).where(eq(teacherAppraisals.id, targetId))
    if (!oldApp) return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 })

    const finalStatus = updates.reviewStatus || status || oldApp.reviewStatus

    const [updatedApp] = await db.update(teacherAppraisals).set({
      ...updates,
      reviewStatus: finalStatus,
      updatedAt: new Date()
    }).where(eq(teacherAppraisals.id, targetId)).returning()

    await logAuditAction({
      userActionType: 'UPDATE_APPRAISAL',
      tableName: 'teacher_appraisals',
      recordId: updatedApp.id,
      oldValues: oldApp,
      newValues: updatedApp,
      req
    })

    return NextResponse.json({ ...updatedApp, _id: updatedApp.id, status: updatedApp.reviewStatus })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update appraisal' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldApp] = await db.select().from(teacherAppraisals).where(eq(teacherAppraisals.id, id))
    if (oldApp) {
      await db.delete(teacherAppraisals).where(eq(teacherAppraisals.id, id))
      await logAuditAction({
        userActionType: 'DELETE_APPRAISAL',
        tableName: 'teacher_appraisals',
        recordId: id,
        oldValues: oldApp,
        req
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete appraisal' }, { status: 500 })
  }
}
