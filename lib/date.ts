// Platform-wide date display format: "15 Jul 2026" (day, short month, full year).
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Same as formatDate but with a trailing time, e.g. "15 Jul 2026, 3:45 PM".
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${formatDate(d)}, ${time}`
}

// Same as formatDate but prefixed with the weekday name, e.g. "Monday, 15 Jul 2026".
export function formatDateWithWeekday(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' })
  return `${weekday}, ${formatDate(d)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

// Parses a target/deadline date from an ISO string, an Excel date serial number,
// or a "<start> - <end>" range string (uses the end token). Returns null when
// nothing parseable is found.
export function parseTargetDate(val: string | number | null | undefined): Date | null {
  if (val === null || val === undefined) return null
  const str = String(val).trim()
  if (!str) return null

  const token = str.includes(' - ') ? str.split(' - ').pop()!.trim() : str
  if (!token) return null

  if (/^\d{4,6}(\.\d+)?$/.test(token)) {
    const num = parseFloat(token)
    if (num > 30000 && num < 70000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000))
      if (!isNaN(d.getTime())) return d
    }
  }

  const parsed = new Date(token)
  if (isNaN(parsed.getTime())) return null

  // Tokens like "Oct 30" have no year — JS defaults those to 2001, not the
  // current year, so re-parse with one pinned on explicitly. Validating the
  // bare token first (above) guards against garbage strings like "TBD"
  // silently becoming "parseable" once a year suffix is appended to them.
  if (!/\b\d{4}\b/.test(token)) {
    const withYear = new Date(`${token}, ${new Date().getFullYear()}`)
    if (!isNaN(withYear.getTime())) return withYear
  }

  return parsed
}

export type UrgencyLevel = 'none' | 'safe' | 'warning' | 'critical' | 'overdue' | 'done'

export interface Urgency {
  level: UrgencyLevel
  daysRemaining: number | null
  label: string
}

// Computes deadline urgency relative to today. isDone short-circuits to a
// neutral 'done' state regardless of how far past the target date is.
export function getUrgency(targetDate: Date | null, isDone: boolean = false): Urgency {
  if (isDone) return { level: 'done', daysRemaining: null, label: 'Completed' }
  if (!targetDate) return { level: 'none', daysRemaining: null, label: '' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)

  const daysRemaining = Math.round((target.getTime() - today.getTime()) / DAY_MS)

  if (daysRemaining < 0) return { level: 'overdue', daysRemaining, label: `Overdue by ${Math.abs(daysRemaining)}d` }
  if (daysRemaining === 0) return { level: 'critical', daysRemaining, label: 'Due today' }
  if (daysRemaining < 3) return { level: 'critical', daysRemaining, label: `${daysRemaining}d left` }
  if (daysRemaining <= 14) return { level: 'warning', daysRemaining, label: `${daysRemaining}d left` }
  return { level: 'safe', daysRemaining, label: `${daysRemaining}d left` }
}
