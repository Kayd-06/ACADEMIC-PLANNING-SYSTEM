import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listMasterSheetRows } from '@/lib/db/queries/curriculum'

export const dynamic = 'force-dynamic'

// GET — return the flat 8-column master sheet joining chapters + concepts + subjects + programs.
// Any authenticated staff role may read.
// Query params (all optional):
//   ?board=CBSE
//   ?classLevel=11
//   ?programId=<uuid>
//   ?subjectId=<uuid>
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    const { searchParams } = new URL(req.url)

    const filters = {
      board: searchParams.get('board') || null,
      classLevel: searchParams.get('classLevel') || null,
      programId: searchParams.get('programId') || null,
      subjectId: searchParams.get('subjectId') || null,
    }

    const rows = await listMasterSheetRows(filters, schoolId)
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('master-sheet GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
