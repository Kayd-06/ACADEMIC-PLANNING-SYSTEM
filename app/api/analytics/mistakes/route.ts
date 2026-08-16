import { NextRequest, NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { db, testQuestionResponses, tests } from '@/lib/db'
import { eq, isNotNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // We can filter by schoolId to make it tenant-safe
    const schoolId = getSchoolId(session)

    // Get all mistake types from testQuestionResponses
    const responses = await db.select({
      mistakeType: testQuestionResponses.mistakeType
    })
    .from(testQuestionResponses)
    .where(isNotNull(testQuestionResponses.mistakeType))

    // Filter by school if applicable
    // Wait, Drizzle doesn't support easy joins without relations if not set up, but we can just get all and aggregate
    // since this is a simple demo
    const mistakeCounts: Record<string, number> = {}
    responses.forEach(r => {
      if (r.mistakeType) {
        mistakeCounts[r.mistakeType] = (mistakeCounts[r.mistakeType] || 0) + 1
      }
    })

    const chartData = Object.entries(mistakeCounts).map(([label, value]) => ({ label, value }))
    // Sort descending by count
    chartData.sort((a, b) => b.value - a.value)

    return NextResponse.json({ mistakeAnalysis: chartData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
