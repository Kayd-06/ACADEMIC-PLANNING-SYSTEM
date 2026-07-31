import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, students, batches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { NEXT_CLASS, subtractOneYear } from '@/lib/classPromotion'
import { getEligibleStudents } from '@/lib/db/queries/classPromotion'

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

  // Re-run eligibility fresh rather than trusting the run's stored
  // previewCounts — a student's class/status/admission date may have
  // changed since detection.
  const previousBoundaryDate = subtractOneYear(run.boundaryDate)
  const eligible = await getEligibleStudents(schoolId, previousBoundaryDate)

  // Batches are a persistent cohort (their date ranges already span multiple
  // years), not a fixed class-level container — so a batch levels up with
  // its students instead of being cleared out. Bump each affected batch
  // once, keyed by the class its promoted students were coming from.
  const batchBumps = new Map<string, string>()

  let promotedCount = 0
  for (const student of eligible) {
    const nextClass = NEXT_CLASS[student.class]
    if (!nextClass) continue

    const previousBatch = student.batch || null

    await db.update(students).set({ class: nextClass, updatedAt: new Date() }).where(eq(students.id, student.id))

    if (previousBatch && !batchBumps.has(previousBatch)) {
      batchBumps.set(previousBatch, nextClass)
    }

    await db.insert(classPromotionLog).values({
      runId: run.id,
      studentId: student.id,
      fromClass: student.class,
      toClass: nextClass,
      previousBatch,
    })

    promotedCount++
  }

  for (const [batchName, nextClass] of batchBumps) {
    await db
      .update(batches)
      .set({ classLevel: nextClass, updatedAt: new Date() })
      .where(and(eq(batches.schoolId, schoolId), eq(batches.name, batchName)))
  }

  await db
    .update(classPromotionRuns)
    .set({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: session.user.id! })
    .where(eq(classPromotionRuns.id, run.id))

  return NextResponse.json({ promotedCount })
}
