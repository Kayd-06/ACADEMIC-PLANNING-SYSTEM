// Validation for academic planning stat tiles (no DB access, unit-tested).
// Metrics are created explicitly by staff; nothing is seeded.

export const METRIC_CATEGORIES = ['header_stat', 'quality_stat'] as const
export type MetricCategory = (typeof METRIC_CATEGORIES)[number]

export interface MetricInput {
  label?: string
  value?: string
  trend?: string
  category?: MetricCategory
  chartData?: number[]
}

const LIMITS = { label: 255, value: 50, trend: 50 } as const

/**
 * Returns the validated fields or an error message. On create (partial=false)
 * label, value, trend and category are required; on update only the given
 * fields are checked. chartData values are bar heights in percent (0–100).
 */
export function parseMetricInput(body: Record<string, unknown>, partial: boolean): { ok: true; value: MetricInput } | { ok: false; error: string } {
  const out: MetricInput = {}
  for (const key of ['label', 'value', 'trend'] as const) {
    const v = body[key]
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      if (!partial) return { ok: false, error: `${key} is required` }
      continue
    }
    if (typeof v !== 'string' && typeof v !== 'number') return { ok: false, error: `${key} is invalid` }
    const s = String(v).trim()
    if (s.length > LIMITS[key]) return { ok: false, error: `${key} is too long` }
    out[key] = s
  }
  if (body.category !== undefined && body.category !== '') {
    if (!METRIC_CATEGORIES.includes(body.category as MetricCategory)) {
      return { ok: false, error: 'category must be header_stat or quality_stat' }
    }
    out.category = body.category as MetricCategory
  } else if (!partial) {
    return { ok: false, error: 'category is required' }
  }
  if (body.chartData !== undefined) {
    if (!Array.isArray(body.chartData) || body.chartData.length > 50) return { ok: false, error: 'chartData must be up to 50 numbers' }
    const nums = body.chartData.map(Number)
    if (nums.some(n => !Number.isFinite(n))) return { ok: false, error: 'chartData must be numbers' }
    out.chartData = nums.map(n => Math.max(0, Math.min(100, n)))
  }
  return { ok: true, value: out }
}
