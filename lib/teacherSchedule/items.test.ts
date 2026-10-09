import { canManageItem, parseScheduleItem } from './items'

describe('parseScheduleItem', () => {
  it('requires activity and time on create', () => {
    expect(parseScheduleItem({ activity: 'Doubt session' }, false)).toEqual({ ok: false, error: 'activity and time are required' })
    expect(parseScheduleItem({ activity: ' Doubt session ', time: '10:00 AM', date: '' }, false))
      .toEqual({ ok: true, value: { activity: 'Doubt session', time: '10:00 AM' } })
  })
  it('validates date, lengths and status', () => {
    expect(parseScheduleItem({ date: '12/10/2026' }, true).ok).toBe(false)
    expect(parseScheduleItem({ location: 'x'.repeat(101) }, true).ok).toBe(false)
    expect(parseScheduleItem({ status: 'Hacked' }, true).ok).toBe(false)
    expect(parseScheduleItem({ status: 'Completed' }, true)).toEqual({ ok: true, value: { status: 'Completed' } })
    expect(parseScheduleItem({ activity: '' }, true).ok).toBe(false)
  })
})

describe('canManageItem', () => {
  it('limits teachers to their own items', () => {
    expect(canManageItem({ role: 'teacher', email: 'A@x.com' }, { ownerEmail: 'a@x.com' })).toBe(true)
    expect(canManageItem({ role: 'teacher', email: 'a@x.com' }, { ownerEmail: 'b@x.com' })).toBe(false)
    expect(canManageItem({ role: 'teacher', email: '' }, { ownerEmail: '' })).toBe(false)
    expect(canManageItem({ role: 'management', email: 'm@x.com' }, { ownerEmail: 'b@x.com' })).toBe(true)
  })
})
