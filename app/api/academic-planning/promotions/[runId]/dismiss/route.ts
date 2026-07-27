import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { runId } = await params
  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

  const [run] = await db.select().from(classPromotionRuns).where(eq(classPromotionRuns.id, runId))
  if (!run || run.schoolId !== schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'pending') return NextResponse.json({ error: `Run is already ${run.status}` }, { status: 400 })

  const [updated] = await db.update(classPromotionRuns).set({ status: 'dismissed' }).where(eq(classPromotionRuns.id, runId)).returning()
  return NextResponse.json(updated)
}
