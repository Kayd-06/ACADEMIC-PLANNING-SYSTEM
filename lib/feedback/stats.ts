import type { Feedback } from '@/lib/db/schema'

// Only the two staff flows are shown in the UI for now. Student/Parent rows stay in the table.
export const STAFF_FLOW_TYPES = ['Teacher -> Management', 'Management -> Teacher'] as const

const PENDING_STATUSES = ['Submitted', 'Reviewed']
const ACTIONED_STATUSES = ['Actioned', 'Dismissed']

export interface FeedbackStats {
  totalCount: number
  thisMonthCount: number
  avgRating: number
  pendingCount: number
  actionedCount: number
  ratingDistribution: Record<number, number>
}

export function isStaffFlow(type: string): boolean {
  return (STAFF_FLOW_TYPES as readonly string[]).includes(type)
}

// Any view other than 'actioned' is treated as 'pending'.
export function filterByView(items: Feedback[], view: string): Feedback[] {
  const statuses = view === 'actioned' ? ACTIONED_STATUSES : PENDING_STATUSES
  return items.filter(i => statuses.includes(i.status))
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function computeFeedbackStats(items: Feedback[], now: Date): FeedbackStats {
  const monthPrefix = now.toISOString().slice(0, 7)
  const rated = items.filter(i => Number.isFinite(i.rating) && i.rating >= 1 && i.rating <= 5)

  const avgRating = rated.length > 0
    ? Number((rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1))
    : 0

  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  rated.forEach(i => { counts[Math.round(i.rating)]++ })
  const ratingDistribution: Record<number, number> = {}
  for (const stars of [5, 4, 3, 2, 1]) {
    ratingDistribution[stars] = rated.length > 0 ? Math.round((counts[stars] / rated.length) * 100) : 0
  }

  return {
    totalCount: items.length,
    thisMonthCount: items.filter(i => ISO_DATE.test(i.date) && i.date.startsWith(monthPrefix)).length,
    avgRating,
    pendingCount: filterByView(items, 'pending').length,
    actionedCount: filterByView(items, 'actioned').length,
    ratingDistribution,
  }
}
