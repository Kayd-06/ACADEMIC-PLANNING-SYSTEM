import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ pending: null, history: [] })

  const runs = await db
    .select({
      id: classPromotionRuns.id,
      academicYear: classPromotionRuns.academicYear,
      boundaryDate: classPromotionRuns.boundaryDate,
      status: classPromotionRuns.status,
      previewCounts: classPromotionRuns.previewCounts,
      excludedNewAdmissionCount: classPromotionRuns.excludedNewAdmissionCount,
      excludedTerminalCount: classPromotionRuns.excludedTerminalCount,
      confirmedAt: classPromotionRuns.confirmedAt,
      confirmedBy: classPromotionRuns.confirmedBy,
      createdAt: classPromotionRuns.createdAt,
      confirmedByName: users.name,
    })
    .from(classPromotionRuns)
    .leftJoin(users, eq(classPromotionRuns.confirmedBy, users.id))
    .where(eq(classPromotionRuns.schoolId, schoolId))
    .orderBy(classPromotionRuns.createdAt)

  const runIds = runs.map((r) => r.id)
  const logRows = runIds.length > 0
    ? await db.select({ runId: classPromotionLog.runId }).from(classPromotionLog).where(inArray(classPromotionLog.runId, runIds))
    : []

  const promotedCountByRunId = new Map<string, number>()
  for (const row of logRows) {
    promotedCountByRunId.set(row.runId, (promotedCountByRunId.get(row.runId) ?? 0) + 1)
  }

  const result = runs.map((run) => ({ ...run, promotedCount: promotedCountByRunId.get(run.id) ?? 0 }))
  const pending = result.find((r) => r.status === 'pending') ?? null
  const history = result.filter((r) => r.status !== 'pending')

  return NextResponse.json({ pending, history })
}
