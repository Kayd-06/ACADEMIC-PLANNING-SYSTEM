// Validation and ownership rules for teacher schedule items (pure, unit-tested).

export const SCHEDULE_STATUSES = ['Upcoming', 'Pending', 'In Progress', 'Completed', 'Cancelled'] as const

export interface ScheduleItemInput {
  date?: string
  time?: string
  activity?: string
  batch?: string
  location?: string
  status?: string | null
}

const LIMITS: Record<keyof Omit<ScheduleItemInput, 'status'>, number> = {
  date: 10, time: 20, activity: 255, batch: 255, location: 100,
}

export function parseScheduleItem(body: Record<string, unknown>, partial: boolean):
  { ok: true; value: ScheduleItemInput } | { ok: false; error: string } {
  const out: ScheduleItemInput = {}
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    const v = body[key]
    if (v === undefined || v === null) continue
    if (typeof v !== 'string' && typeof v !== 'number') return { ok: false, error: `${key} is invalid` }
    const s = String(v).trim()
    if (s.length > LIMITS[key]) return { ok: false, error: `${key} is too long` }
    out[key] = s
  }
  if (out.date !== undefined && out.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD' }
  }
  if (out.date === '') delete out.date
  if (body.status !== undefined) {
    if (body.status === null || body.status === '') out.status = null
    else if (SCHEDULE_STATUSES.includes(body.status as (typeof SCHEDULE_STATUSES)[number])) out.status = body.status as string
    else return { ok: false, error: `status must be one of: ${SCHEDULE_STATUSES.join(', ')}` }
  }
  if (!partial && (!out.activity || !out.time)) return { ok: false, error: 'activity and time are required' }
  if (partial && (out.activity === '' || out.time === '')) return { ok: false, error: 'activity and time cannot be empty' }
  return { ok: true, value: out }
}

/** Teachers see and change only their own items; management the whole school. */
export function canManageItem(ctx: { role: 'management' | 'teacher'; email: string }, item: { ownerEmail: string }): boolean {
  if (ctx.role === 'management') return true
  return !!ctx.email && item.ownerEmail.toLowerCase() === ctx.email.toLowerCase()
}
