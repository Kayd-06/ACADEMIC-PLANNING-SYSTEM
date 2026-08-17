import { NextRequest, NextResponse } from 'next/server'
import { db, progressReports } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getOrdinalRank(n: number, total: number): string {
  if (n <= 0) return '-'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  const suffix = (s[(v - 20) % 10] || s[v] || s[0])
  return total > 1 ? `${n}${suffix} / ${total}` : `${n}${suffix}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = getSchoolId(session)
    const conditions = schoolId ? [eq(progressReports.schoolId, schoolId)] : []

    const allReports = conditions.length
      ? await db.select().from(progressReports).where(and(...conditions))
      : await db.select().from(progressReports)

    const parsePct = (val?: string | null) => parseFloat(String(val || '0').replace(/%/g, '').trim()) || 0

    // Group by batch + termType + academicYear
    const cohortGroups = new Map<string, typeof allReports>()
    for (const r of allReports) {
      const key = `${r.batch}:::${r.termType}:::${r.academicYear}`
      const list = cohortGroups.get(key) || []
      list.push(r)
      cohortGroups.set(key, list)
    }

    let updatedCount = 0
    for (const cohortList of cohortGroups.values()) {
      const sorted = [...cohortList].sort((a, b) => parsePct(b.percentage) - parsePct(a.percentage))
      const total = sorted.length

      for (let i = 0; i < sorted.length; i++) {
        const rankOrdinal = getOrdinalRank(i + 1, total)
        const currentPct = parsePct(sorted[i].percentage)
        const countLessOrEqual = sorted.filter(r => parsePct(r.percentage) <= currentPct).length
        const percentile = total > 0 ? (Math.round((countLessOrEqual / total) * 10000) / 100).toString() : '0'

        if (sorted[i].rank !== rankOrdinal || sorted[i].percentile !== percentile) {
          await db.update(progressReports)
            .set({ rank: rankOrdinal, percentile })
            .where(eq(progressReports.id, sorted[i].id))
          updatedCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ranks & percentiles across ${cohortGroups.size} cohort(s).`,
      totalReports: allReports.length,
      updatedCount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
