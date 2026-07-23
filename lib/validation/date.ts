/**
 * Checks if the end date is on or after the start date.
 * If either date is missing or empty, returns true (since date range is optional).
 * Returns false if endDate is chronologically before startDate.
 */
export function isValidDateRange(startDate?: string | null, endDate?: string | null): boolean {
  const startTrimmed = (startDate || '').trim()
  const endTrimmed = (endDate || '').trim()

  if (!startTrimmed || !endTrimmed) return true

  const start = new Date(startTrimmed)
  const end = new Date(endTrimmed)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return true

  return end >= start
}

export const DATE_RANGE_ERROR = 'End date cannot be before start date'
