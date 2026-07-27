import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, students, studentBatchEnrollments } from '@/lib/db/schema'
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

  let promotedCount = 0
  for (const student of eligible) {
    const nextClass = NEXT_CLASS[student.class]
    if (!nextClass) continue

    const previousBatch = student.batch || null

    await db.update(students).set({ class: nextClass, batch: '', updatedAt: new Date() }).where(eq(students.id, student.id))

    if (previousBatch) {
      await db
        .update(studentBatchEnrollments)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(and(
          eq(studentBatchEnrollments.studentId, student.id),
          eq(studentBatchEnrollments.batchName, previousBatch),
          eq(studentBatchEnrollments.status, 'active'),
        ))
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

  await db
    .update(classPromotionRuns)
    .set({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: session.user.id! })
    .where(eq(classPromotionRuns.id, run.id))

  return NextResponse.json({ promotedCount })
}
