import type { SpecialClass } from '@/lib/db/schema'

// Helpers for the routes that used to read MongoDB "TeacherSchedule" /
// "Orientation" documents and now read Postgres special_classes. They keep
// the old JSON shape (`_id`, `time`, `activity`, `location`, `status`, ...).

/** YYYY-MM-DD in India time (the app's users are in IST). */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().split('T')[0]
}

/** Mongo TeacherSchedule.status had no Postgres column; derive it from the date. */
export function scheduleStatus(date: string, today = todayIST()): 'Upcoming' | 'Completed' {
  return date < today ? 'Completed' : 'Upcoming'
}

export function toTeacherSchedule(row: SpecialClass, today = todayIST()) {
  return {
    _id: row.id,
    id: row.id,
    date: row.date,
    time: row.startTime,
    activity: row.title,
    batch: row.batch,
    location: row.room,
    status: scheduleStatus(row.date, today),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "2026-10-12" -> "OCT 12" (the Orientation card format). */
export function shortDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`.trim()
}

export function toOrientation(row: SpecialClass) {
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    date: shortDate(row.date),
    isoDate: row.date,
    location: row.room,
    time: row.startTime,
    createdAt: row.createdAt,
  }
}
