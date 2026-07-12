// Shared helpers for turning classSchedules (recurring weekly slots) and
// specialClasses (one-off sessions) rows into a single "today's classes"
// list, used by both the management and teacher dashboards.

export function getLocalToday(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

export function parseHour(t: string): number {
  if (!t) return 0
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return 0
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const period = m[3]?.toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h + min / 60
}

export interface TodayClassEntry {
  id: string
  time: string
  title: string
  batch: string
  room: string
  teacherName?: string
  type?: string
  sortKey: number
}

// `special` should already be scoped to today's date (e.g. via
// /api/special-classes?date=...); `regular` is filtered here since
// classSchedules rows carry a dayOfWeek + optional effective date range
// rather than a specific date.
export function buildTodaysClasses(
  regular: any[],
  special: any[],
  todayIso: string,
  todayDow: number,
  includeTeacher = false
): TodayClassEntry[] {
  const entries: TodayClassEntry[] = []

  regular.forEach(s => {
    if (s.dayOfWeek !== todayDow) return
    if (s.effectiveFrom && todayIso < s.effectiveFrom) return
    if (s.effectiveTo && todayIso > s.effectiveTo) return
    entries.push({
      id: s._id,
      time: `${s.startTime} - ${s.endTime}`,
      title: s.subject,
      batch: s.batch,
      room: s.room,
      teacherName: includeTeacher ? s.teacherName : undefined,
      sortKey: parseHour(s.startTime),
    })
  })

  special.forEach(sc => {
    if (sc.date !== todayIso) return
    entries.push({
      id: sc._id,
      time: `${sc.startTime} - ${sc.endTime}`,
      title: sc.title,
      batch: [sc.batch, sc.subject].filter(Boolean).join(' • '),
      room: sc.room,
      teacherName: includeTeacher ? sc.teacherName : undefined,
      type: sc.type,
      sortKey: parseHour(sc.startTime),
    })
  })

  return entries.sort((a, b) => a.sortKey - b.sortKey)
}
