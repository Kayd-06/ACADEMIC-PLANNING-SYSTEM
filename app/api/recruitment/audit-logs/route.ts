import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { errorResponse, pickAllowed } from '@/lib/api/http'
import { requireRecruitmentAccess } from '@/lib/recruitment/access'

export const dynamic = 'force-dynamic'

// The recruitment UI lets management correct an audit entry's text fields;
// identity, school and timestamp columns are never editable.
const EDITABLE = ['userActionType', 'tableName', 'recordId', 'oldValues', 'newValues', 'authorName', 'authorRole'] as const

export async function GET() {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const rows = await db.select().from(auditLogs)
      .where(inArray(auditLogs.schoolId, schoolIds))
      .orderBy(desc(auditLogs.timestamp))
      .limit(100)
    return NextResponse.json(rows.map(r => ({ ...r, _id: r.id })))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/audit-logs', { fallbackMessage: 'Failed to fetch audit logs' })
  }
}

export async function PATCH(req: Request) {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const body = await req.json()
    const targetId = body.id || body._id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const updates: Record<string, unknown> = pickAllowed(body, EDITABLE)
    for (const [k, v] of Object.entries(updates)) if (typeof v !== 'string') updates[k] = v == null ? '' : String(v)
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    const [updatedLog] = await db.update(auditLogs).set(updates)
      .where(and(eq(auditLogs.id, targetId), inArray(auditLogs.schoolId, schoolIds)))
      .returning()
    if (!updatedLog) return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })

    return NextResponse.json({ ...updatedLog, _id: updatedLog.id })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/recruitment/audit-logs', { fallbackMessage: 'Failed to update audit log' })
  }
}

export async function DELETE(req: Request) {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [deletedLog] = await db.delete(auditLogs)
      .where(and(eq(auditLogs.id, id), inArray(auditLogs.schoolId, schoolIds)))
      .returning()
    if (!deletedLog) return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })

    return NextResponse.json({ success: true, deletedId: deletedLog.id })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/recruitment/audit-logs', { fallbackMessage: 'Failed to delete audit log' })
  }
}
