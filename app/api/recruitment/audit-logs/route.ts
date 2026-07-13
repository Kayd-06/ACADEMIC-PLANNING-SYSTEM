import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(100)
    const formatted = rows.map(r => ({
      ...r,
      _id: r.id
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, _id, ...updates } = body
    const targetId = id || _id
    if (!targetId) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [oldLog] = await db.select().from(auditLogs).where(eq(auditLogs.id, targetId))
    if (!oldLog) return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })

    const [updatedLog] = await db.update(auditLogs).set({
      ...updates
    }).where(eq(auditLogs.id, targetId)).returning()

    return NextResponse.json({ ...updatedLog, _id: updatedLog.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update audit log' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const [deletedLog] = await db.delete(auditLogs).where(eq(auditLogs.id, id)).returning()
    if (!deletedLog) return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })

    return NextResponse.json({ success: true, deletedId: deletedLog.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete audit log' }, { status: 500 })
  }
}
