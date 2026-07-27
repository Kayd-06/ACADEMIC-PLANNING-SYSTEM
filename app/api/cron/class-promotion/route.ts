import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schools, classPromotionRuns, notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { computeBoundaryDate, subtractOneYear, computeAcademicYearLabel, buildPreviewCounts } from '@/lib/classPromotion'
import {
  getEligibleStudents,
  getExcludedNewAdmissionCount,
  getActiveClass12Count,
  getManagementUserIds,
} from '@/lib/db/queries/classPromotion'

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
    const boundaryDate = computeBoundaryDate(school.academicYearStartMonth)
    const academicYear = computeAcademicYearLabel(boundaryDate)

    const existing = await db
      .select({ id: classPromotionRuns.id })
      .from(classPromotionRuns)
      .where(and(eq(classPromotionRuns.schoolId, school.id), eq(classPromotionRuns.academicYear, academicYear)))
    if (existing.length > 0) continue

    const previousBoundaryDate = subtractOneYear(boundaryDate)
    const eligible = await getEligibleStudents(school.id, previousBoundaryDate)
    const excludedNewAdmissionCount = await getExcludedNewAdmissionCount(school.id, previousBoundaryDate)
    const excludedTerminalCount = await getActiveClass12Count(school.id)
    const previewCounts = buildPreviewCounts(eligible)

    await db.insert(classPromotionRuns).values({
      schoolId: school.id,
      academicYear,
      boundaryDate,
      status: 'pending',
      previewCounts,
      excludedNewAdmissionCount,
      excludedTerminalCount,
    })
    runsCreated++

    const managementUserIds = await getManagementUserIds(school.id)
    for (const userId of managementUserIds) {
      await db.insert(notifications).values({
        userId,
        category: 'General',
        title: 'Class promotion ready for review',
        message: `${academicYear} class promotion is ready to review for your school.`,
        link: '/management/academic-planning?tab=Promotion',
        schoolId: school.id,
      })
    }
  }

  return NextResponse.json({ runsCreated })
}
