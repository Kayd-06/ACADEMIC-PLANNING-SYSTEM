import { NextResponse } from 'next/server'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { specialClasses } from '@/lib/db/schema'
import { requireRecruitmentAccess } from '@/lib/recruitment/access'
import { errorResponse } from '@/lib/api/http'
import { toOrientation } from '@/lib/legacyPortal'

export const dynamic = 'force-dynamic'

// Orientation sessions — moved from the MongoDB Orientation collection to
// Postgres special_classes rows with type 'Orientation' (created through the
// existing special-classes scheduler). Same shape as before
// ({ _id, title, date: "OCT 12", location, time }). Read-only: the old GET
// inserted two demo orientations whenever the collection was empty.
export async function GET() {
  try {
    const { schoolIds } = await requireRecruitmentAccess()
    const rows = await db.select().from(specialClasses)
      .where(and(eq(specialClasses.type, 'Orientation'), inArray(specialClasses.schoolId, schoolIds)))
      .orderBy(asc(specialClasses.date), asc(specialClasses.startTime))
    return NextResponse.json(rows.map(toOrientation))
  } catch (error) {
    return errorResponse(error, 'GET /api/recruitment/orientations')
  }
}
