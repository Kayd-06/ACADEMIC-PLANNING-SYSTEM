import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { computeFeeStats } from '@/lib/db/queries/fees'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // School comes from the session only (no ?schoolId= override).
    const schoolId = requireSchool(session)

    const stats = await computeFeeStats(schoolId)

    return NextResponse.json(stats)
  } catch (error) {
    return errorResponse(error, 'GET /api/fees/stats')
  }
}
