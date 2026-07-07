import { NextRequest, NextResponse } from 'next/server'
import { db, tests, questions } from '@/lib/db'
import { eq, and, count, avg, gte, lte, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Returns the ISO date strings for Monday and Sunday of the current week
function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

// GET — return KPI stats for the Tests & Question Bank page
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null

    // ── Base conditions ──────────────────────────────────────────────────────
    const schoolCondition = schoolId ? eq(tests.schoolId, schoolId) : sql`1=1`
    const qSchoolCondition = schoolId ? eq(questions.schoolId, schoolId) : sql`1=1`

    // ── 1. Scheduled this week ───────────────────────────────────────────────
    const { start, end } = getCurrentWeekRange()
    const [{ value: scheduledThisWeek }] = await db
      .select({ value: count() })
      .from(tests)
      .where(and(schoolCondition, gte(tests.date, start), lte(tests.date, end)))

    // ── 2. Total questions in the bank ───────────────────────────────────────
    const [{ value: totalQuestions }] = await db
      .select({ value: count() })
      .from(questions)
      .where(qSchoolCondition)

    // ── 3. Average score across all graded tests ─────────────────────────────
    const [avgRow] = await db
      .select({ value: avg(tests.averageScore) })
      .from(tests)
      .where(and(schoolCondition, eq(tests.status, 'Graded')))
    const avgScore = avgRow?.value ? Math.round(Number(avgRow.value)) : 0

    // ── 4. Pending grading count ─────────────────────────────────────────────
    const [{ value: pendingGrading }] = await db
      .select({ value: count() })
      .from(tests)
      .where(and(schoolCondition, eq(tests.status, 'Pending Grading')))

    // ── 5. Batch-wise averages (for bar chart) ───────────────────────────────
    // Fetch all graded tests with an averageScore and group in JS
    const gradedTests = await db
      .select({ batch: tests.batch, averageScore: tests.averageScore })
      .from(tests)
      .where(and(schoolCondition, eq(tests.status, 'Graded'), sql`${tests.averageScore} IS NOT NULL`))

    const batchMap: Record<string, { total: number; count: number }> = {}
    for (const t of gradedTests) {
      if (!t.batch || t.averageScore === null) continue
      if (!batchMap[t.batch]) batchMap[t.batch] = { total: 0, count: 0 }
      batchMap[t.batch].total += t.averageScore
      batchMap[t.batch].count += 1
    }
    const batchAverages = Object.entries(batchMap).map(([batch, { total, count: c }]) => ({
      batch,
      avgScore: Math.round(total / c),
    }))

    return NextResponse.json({
      scheduledThisWeek: Number(scheduledThisWeek),
      totalQuestions: Number(totalQuestions),
      avgScore,
      pendingGrading: Number(pendingGrading),
      batchAverages,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
