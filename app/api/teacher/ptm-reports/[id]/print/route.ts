import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ptmReports } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    const schoolId = (session.user as any).schoolId ?? null

    // Ensure the report belongs to the user's school if applicable
    const condition = schoolId 
      ? and(eq(ptmReports.id, id), eq(ptmReports.schoolId, schoolId))
      : eq(ptmReports.id, id)

    const updated = await db.update(ptmReports)
      .set({
        printedAt: new Date(),
        printCount: sql`${ptmReports.printCount} + 1`
      })
      .where(condition)
      .returning()

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'PTM Report not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'PTM report print status updated',
      report: updated[0]
    })
  } catch (error: any) {
    console.error('Error updating PTM print status:', error)
    return NextResponse.json({ error: error.message || 'Failed to update PTM print status' }, { status: 500 })
  }
}
