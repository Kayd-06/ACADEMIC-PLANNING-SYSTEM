import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { computeFeeStats } from '@/lib/db/queries/fees'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const schoolId = searchParams.get('schoolId') || (session.user as any)?.schoolId || null

    const stats = await computeFeeStats(schoolId)

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('GET /api/fees/stats error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
