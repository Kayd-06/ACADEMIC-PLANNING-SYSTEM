import { NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { recalculateReportRanks } from '@/lib/db/queries/generated-reports'

export const dynamic = 'force-dynamic'

// POST — recompute batch/class ranks for every generated progress report
export async function POST() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can recalculate ranks' }, { status: 403 })
    }

    const { cohorts, updated } = await recalculateReportRanks(getSchoolId(session))
    return NextResponse.json({
      success: true,
      message: `Recalculated ranks across ${cohorts} batch cohort(s); ${updated} report(s) updated.`,
      updatedCount: updated,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
