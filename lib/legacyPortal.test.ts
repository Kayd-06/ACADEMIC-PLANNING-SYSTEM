import { scheduleStatus, shortDate, todayIST } from '@/lib/legacyPortal'

describe('legacyPortal helpers', () => {
  it('formats orientation dates like the old cards', () => {
    expect(shortDate('2026-10-12')).toBe('OCT 12')
    expect(shortDate('2026-01-05')).toBe('JAN 5')
    expect(shortDate('OCT 12')).toBe('OCT 12')
  })

  it('derives schedule status from the date', () => {
    expect(scheduleStatus('2026-10-07', '2026-10-08')).toBe('Completed')
    expect(scheduleStatus('2026-10-08', '2026-10-08')).toBe('Upcoming')
  })

  it('uses India time for "today"', () => {
    expect(todayIST(new Date('2026-10-07T19:00:00Z'))).toBe('2026-10-08')
    expect(todayIST(new Date('2026-10-07T18:00:00Z'))).toBe('2026-10-07')
  })
})
