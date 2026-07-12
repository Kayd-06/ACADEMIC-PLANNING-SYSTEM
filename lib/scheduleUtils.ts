// Shared helpers for turning classSchedules (recurring weekly slots) and
// specialClasses (one-off sessions) rows into a single "today's classes"
// list, used by both the management and teacher dashboards.

// Fixed to IST rather than the runtime's own timezone: this must return the
// same calendar date whether it's called from a browser (viewer's local
// clock) or a Vercel serverless function (which runs in UTC) — using
// getTimezoneOffset() here would silently disagree between the two,
// making "today" resolve to the wrong date on the server for part of the
// day (e.g. treating an evening IST class as tomorrow, or excluding it as
// "yesterday" once past midnight UTC).
export function getLocalToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
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
  date: string
  startTime: string
  endTime: string
  time: string
  title: string
  subject: string
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
      date: todayIso,
      startTime: s.startTime,
      endTime: s.endTime,
      time: `${s.startTime} - ${s.endTime}`,
      title: s.subject,
      subject: s.subject,
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
      date: sc.date,
      startTime: sc.startTime,
      endTime: sc.endTime,
      time: `${sc.startTime} - ${sc.endTime}`,
      title: sc.title,
      subject: sc.subject || sc.title,
      batch: sc.batch,
      room: sc.room,
      teacherName: includeTeacher ? sc.teacherName : undefined,
      type: sc.type,
      sortKey: parseHour(sc.startTime),
    })
  })

  return entries.sort((a, b) => a.sortKey - b.sortKey)
}
