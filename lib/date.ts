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
