import type { Feedback } from '@/lib/db/schema'
import { STAFF_FLOW_TYPES, isStaffFlow, filterByView, computeFeedbackStats } from './stats'

function row(o: Partial<Feedback> = {}): Feedback {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    senderName: 'Sender',
    isAnonymous: false,
    rating: 5,
    content: 'content',
    type: 'Teacher -> Management',
    status: 'Submitted',
    subject: '',
    batch: '',
    category: '',
    date: '2026-10-10',
    schoolId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    ...o,
  }
}

const NOW = new Date('2026-10-15T12:00:00Z')

describe('isStaffFlow', () => {
  it('accepts only the two staff flows', () => {
    expect(STAFF_FLOW_TYPES).toEqual(['Teacher -> Management', 'Management -> Teacher'])
    expect(isStaffFlow('Teacher -> Management')).toBe(true)
    expect(isStaffFlow('Management -> Teacher')).toBe(true)
    expect(isStaffFlow('Student -> Teacher')).toBe(false)
    expect(isStaffFlow('Parent -> School')).toBe(false)
    expect(isStaffFlow('')).toBe(false)
  })
})

describe('filterByView', () => {
  const statuses = ['Submitted', 'Reviewed', 'Actioned', 'Dismissed']

  it('puts every status in exactly one of pending / actioned', () => {
    for (const status of statuses) {
      const items = [row({ status })]
      const inPending = filterByView(items, 'pending').length
      const inActioned = filterByView(items, 'actioned').length
      expect(inPending + inActioned).toBe(1)
    }
  })

  it('pending = Submitted + Reviewed; actioned = Actioned + Dismissed', () => {
    const items = statuses.map(status => row({ status }))
    expect(filterByView(items, 'pending').map(i => i.status).sort()).toEqual(['Reviewed', 'Submitted'])
    expect(filterByView(items, 'actioned').map(i => i.status).sort()).toEqual(['Actioned', 'Dismissed'])
  })

  it('treats an unknown view as pending', () => {
    const items = statuses.map(status => row({ status }))
    expect(filterByView(items, 'bogus')).toEqual(filterByView(items, 'pending'))
    expect(filterByView(items, '')).toEqual(filterByView(items, 'pending'))
  })
})

describe('computeFeedbackStats', () => {
  it('counts only well-formed dates in the current month', () => {
    const items = [
      row({ date: '2026-10-01' }),
      row({ date: '2026-10-31' }),
      row({ date: '2026-09-30' }),
      row({ date: '2020-10-15' }),
      row({ date: '2026-1-5' }),
      row({ date: '' }),
      row({ date: 'garbage' }),
    ]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.totalCount).toBe(7)
    expect(stats.thisMonthCount).toBe(2)
  })

  it('computes pending and actioned counts from the same partition as the lists', () => {
    const items = [
      row({ status: 'Submitted' }),
      row({ status: 'Reviewed' }),
      row({ status: 'Actioned' }),
      row({ status: 'Dismissed' }),
      row({ status: 'Dismissed' }),
    ]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.pendingCount).toBe(2)
    expect(stats.actionedCount).toBe(3)
    expect(stats.pendingCount).toBe(filterByView(items, 'pending').length)
    expect(stats.actionedCount).toBe(filterByView(items, 'actioned').length)
  })

  it('averages and distributes only rows with a valid 1-5 rating', () => {
    const items = [row({ rating: 5 }), row({ rating: 5 }), row({ rating: 4 }), row({ rating: 0 })]
    const stats = computeFeedbackStats(items, NOW)
    expect(stats.avgRating).toBe(4.7)
    expect(stats.ratingDistribution).toEqual({ 5: 67, 4: 33, 3: 0, 2: 0, 1: 0 })
  })

  it('returns zeros, never NaN, for an empty set', () => {
    const stats = computeFeedbackStats([], NOW)
    expect(stats).toEqual({
      totalCount: 0,
      thisMonthCount: 0,
      avgRating: 0,
      pendingCount: 0,
      actionedCount: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    })
  })

  it('returns zero average when no row has a valid rating', () => {
    const stats = computeFeedbackStats([row({ rating: 0 })], NOW)
    expect(stats.avgRating).toBe(0)
    expect(stats.ratingDistribution).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
  })
})
