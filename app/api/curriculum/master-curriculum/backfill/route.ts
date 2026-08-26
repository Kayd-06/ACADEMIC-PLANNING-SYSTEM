import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backfillMasterCurriculumFromNormalized } from '@/lib/db/queries/master-curriculum'

export const dynamic = 'force-dynamic'

// POST — One-time back-fill: reads all chapters + concepts for this school
// from the existing normalized tables and upserts them into master_curriculum.
// Safe to run multiple times (idempotent via upsert).
// Management role only.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role     = (session.user as any).role as string
    const schoolId = (session.user as any).schoolId as string | null

    if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden — management role required' }, { status: 403 })
    }
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })
    }

    const result = await backfillMasterCurriculumFromNormalized(schoolId)

    return NextResponse.json({
      success:  true,
      inserted: result.inserted,
      errors:   result.errors,
      message:  `Back-fill complete. ${result.inserted} concept rows synced to master_curriculum.`,
    })
  } catch (error: any) {
    console.error('master-curriculum backfill POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
