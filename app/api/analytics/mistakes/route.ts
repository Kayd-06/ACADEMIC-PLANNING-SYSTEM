import { NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { db, testQuestionResponses } from '@/lib/db'
import { and, eq, isNotNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = getSchoolId(session)
    if (!schoolId) {
      return NextResponse.json({ error: 'No active school selected' }, { status: 400 })
    }

    const responses = await db.select({
      mistakeType: testQuestionResponses.mistakeType
    })
    .from(testQuestionResponses)
    .where(and(
      eq(testQuestionResponses.schoolId, schoolId),
      isNotNull(testQuestionResponses.mistakeType)
    ))

    const mistakeCounts: Record<string, number> = {}
    responses.forEach(r => {
      if (r.mistakeType) {
        mistakeCounts[r.mistakeType] = (mistakeCounts[r.mistakeType] || 0) + 1
      }
    })

    const chartData = Object.entries(mistakeCounts).map(([label, value]) => ({ label, value }))
    chartData.sort((a, b) => b.value - a.value)

    return NextResponse.json({ mistakeAnalysis: chartData })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load mistake analytics' }, { status: 500 })
  }
}
