import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { attendanceSessions, attendanceEntries } from '@/lib/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function getLastNDaysDates(n: number) {
  const dates: string[] = []
  const today = new Date()
  for (let i = n; i >= 1; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

// GET — attendance metrics computed from Postgres sessions & entries
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const rangeDays = Number(searchParams.get('range') || '30')
    const program = searchParams.get('program') || 'All'
    const batchFilter = searchParams.get('batch') || 'All'

    const dates = getLastNDaysDates(rangeDays)
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    const conditions = [gte(attendanceSessions.date, startDate), lte(attendanceSessions.date, endDate)]
    if (schoolId) conditions.push(eq(attendanceSessions.schoolId, schoolId))
    if (batchFilter !== 'All') {
      conditions.push(eq(attendanceSessions.batch, batchFilter))
    } else if (program === 'JEE Integrated') {
      conditions.push(inArray(attendanceSessions.batch, ['Grade 11-A', 'Grade 11-B']))
    } else if (program === 'Foundational') {
      conditions.push(inArray(attendanceSessions.batch, ['Grade 10-A', 'Grade 10-B']))
    }

    const sessions = await db.select().from(attendanceSessions).where(and(...conditions))
    const sessionIds = sessions.map(s => s.id)
    const entries = sessionIds.length
      ? await db.select().from(attendanceEntries).where(inArray(attendanceEntries.sessionId, sessionIds))
      : []
    const sessionById = new Map(sessions.map(s => [s.id, s]))

    let totalRecords = 0
    let totalPresent = 0
    const batchSubjectStats: Record<string, { present: number; total: number; batch: string; subject: string }> = {}
    const studentStats: Record<string, { name: string; batch: string; present: number; absent: number; total: number; lastAbsent: string }> = {}
    const dailyStats: Record<string, { present: number; total: number }> = {}
    dates.forEach(d => { dailyStats[d] = { present: 0, total: 0 } })

    for (const entry of entries) {
      const sheet = sessionById.get(entry.sessionId)
      if (!sheet) continue
      // Excused absences don't count for or against the rate
      if (entry.status === 'Excused') continue

      const isPresent = entry.status === 'Present' || entry.status === 'Late'
      totalRecords++
      if (isPresent) totalPresent++

      const key = `${sheet.batch} • ${sheet.subject}`
      if (!batchSubjectStats[key]) batchSubjectStats[key] = { present: 0, total: 0, batch: sheet.batch, subject: sheet.subject }
      batchSubjectStats[key].total++
      if (isPresent) batchSubjectStats[key].present++

      if (dailyStats[sheet.date]) {
        dailyStats[sheet.date].total++
        if (isPresent) dailyStats[sheet.date].present++
      }

      const sid = entry.studentId ?? `${entry.studentName}|${sheet.batch}`
      if (!studentStats[sid]) {
        studentStats[sid] = { name: entry.studentName, batch: sheet.batch, present: 0, absent: 0, total: 0, lastAbsent: '' }
      }
      studentStats[sid].total++
      if (isPresent) {
        studentStats[sid].present++
      } else {
        studentStats[sid].absent++
        if (!studentStats[sid].lastAbsent || sheet.date > studentStats[sid].lastAbsent) {
          studentStats[sid].lastAbsent = sheet.date
        }
      }
    }

    const overallRate = totalRecords > 0 ? Number(((totalPresent / totalRecords) * 100).toFixed(1)) : 0

    let batchesBelow75 = 0
    const batchesAttention: any[] = []
    Object.values(batchSubjectStats).forEach(stat => {
      const rate = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0
      if (rate < 75) batchesBelow75++
      batchesAttention.push({
        name: stat.batch,
        subject: stat.subject.split(' ')[0],
        rate,
        needsAttention: rate < 75,
      })
    })
    batchesAttention.sort((a, b) => a.rate - b.rate)

    let perfectAttendanceCount = 0
    const studentTableData: any[] = []
    Object.values(studentStats).forEach(s => {
      if (s.absent === 0 && s.total > 0) perfectAttendanceCount++
      const rate = s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 100
      studentTableData.push({
        name: s.name,
        batch: s.batch,
        present: s.present,
        absent: s.absent,
        rate,
        lastAbsent: s.lastAbsent || '—',
      })
    })
    studentTableData.sort((a, b) => a.rate - b.rate)

    const heatmap = Object.keys(dailyStats).map(d => {
      const stat = dailyStats[d]
      return { date: d, rate: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : null }
    })

    const trendVal = Number((overallRate - 90.3).toFixed(1))
    const trend = totalRecords > 0 ? (trendVal >= 0 ? `+${trendVal}%` : `${trendVal}%`) : '—'

    return NextResponse.json({
      overallRate,
      trend,
      batchesBelow75,
      perfectAttendanceCount,
      heatmap,
      batchesAttention: batchesAttention.slice(0, 4),
      studentTable: studentTableData,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
