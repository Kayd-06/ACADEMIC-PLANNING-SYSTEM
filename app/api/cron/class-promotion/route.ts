import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runPromotionDetectionForSchool } from '@/lib/db/queries/classPromotion'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeSchools = await db
    .select({ id: schools.id, academicYearStartMonth: schools.academicYearStartMonth })
    .from(schools)
    .where(eq(schools.isActive, true))

  let runsCreated = 0
  for (const school of activeSchools) {
    const { created } = await runPromotionDetectionForSchool(school.id, school.academicYearStartMonth)
    if (created) runsCreated++
  }

  return NextResponse.json({ runsCreated })
}
