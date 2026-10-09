import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classPromotionRuns, classPromotionLog, students, batches } from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { NEXT_CLASS, subtractOneYear } from '@/lib/classPromotion'
import { getEligibleStudents } from '@/lib/db/queries/classPromotion'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
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

    // Group students by their class move: one UPDATE per class instead of one
    // per student. Batches are a persistent cohort, so each affected batch
    // levels up once, keyed by the class its promoted students came from.
    const idsByFromClass = new Map<string, string[]>()
    const batchBumps = new Map<string, string>()
    const logRows: Array<typeof classPromotionLog.$inferInsert> = []
    for (const student of eligible) {
      const nextClass = NEXT_CLASS[student.class]
      if (!nextClass) continue
      const list = idsByFromClass.get(student.class) ?? []
      list.push(student.id)
      idsByFromClass.set(student.class, list)
      const previousBatch = student.batch || null
      if (previousBatch && !batchBumps.has(previousBatch)) batchBumps.set(previousBatch, nextClass)
      logRows.push({ runId: run.id, studentId: student.id, fromClass: student.class, toClass: nextClass, previousBatch })
    }

    // Everything below runs as ONE transaction (db.batch). The first
    // statement claims the run (pending -> confirmed) with a unique
    // confirmation timestamp; every following statement only applies if that
    // claim succeeded in this same transaction. A double-click / second admin
    // confirming concurrently therefore promotes nobody twice, and a failure
    // halfway leaves no student half-promoted.
    const now = new Date()
    const userId = session.user.id!
    const claimed = sql`exists (select 1 from ${classPromotionRuns} where ${classPromotionRuns.id} = ${run.id} and ${classPromotionRuns.status} = 'confirmed' and ${classPromotionRuns.confirmedAt} = ${now.toISOString()}::timestamptz and ${classPromotionRuns.confirmedBy} = ${userId})`

    const claim = db.update(classPromotionRuns)
      .set({ status: 'confirmed', confirmedAt: now, confirmedBy: userId })
      .where(and(eq(classPromotionRuns.id, run.id), eq(classPromotionRuns.status, 'pending')))
      .returning({ id: classPromotionRuns.id })

    const studentUpdates = [...idsByFromClass.entries()].map(([fromClass, ids]) =>
      db.update(students)
        .set({ class: NEXT_CLASS[fromClass], updatedAt: now })
        .where(and(inArray(students.id, ids), eq(students.schoolId, schoolId), eq(students.class, fromClass), claimed)),
    )
    const logInsert = logRows.length > 0
      ? [db.insert(classPromotionLog).select(
          // INSERT ... SELECT so the log rows are also conditional on the claim.
          db.select({
            id: sql`gen_random_uuid()`.as('id'),
            runId: sql`v.run_id::uuid`.as('run_id'),
            studentId: sql`v.student_id::uuid`.as('student_id'),
            fromClass: sql`v.from_class`.as('from_class'),
            toClass: sql`v.to_class`.as('to_class'),
            previousBatch: sql`v.previous_batch`.as('previous_batch'),
            createdAt: sql`now()`.as('created_at'),
          }).from(sql`(values ${sql.join(logRows.map(r => sql`(${r.runId}, ${r.studentId}, ${r.fromClass}, ${r.toClass}, ${r.previousBatch ?? null})`), sql`, `)}) as v(run_id, student_id, from_class, to_class, previous_batch)`)
            .where(claimed),
        )]
      : []
    const batchUpdates = [...batchBumps.entries()].map(([batchName, nextClass]) =>
      db.update(batches)
        .set({ classLevel: nextClass, updatedAt: now })
        .where(and(eq(batches.schoolId, schoolId), eq(batches.name, batchName), claimed)),
    )

    const [claimResult] = await db.batch([claim, ...studentUpdates, ...logInsert, ...batchUpdates])
    if (claimResult.length === 0) {
      return NextResponse.json({ error: 'Run was already confirmed or dismissed' }, { status: 409 })
    }

    return NextResponse.json({ promotedCount: logRows.length })
  } catch (error) {
    return errorResponse(error, 'POST /api/academic-planning/promotions/[runId]/confirm')
  }
}
