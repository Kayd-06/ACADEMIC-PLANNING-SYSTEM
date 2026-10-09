import { parseMetricInput } from './metrics'

describe('parseMetricInput', () => {
  it('requires label, value, trend and category on create', () => {
    expect(parseMetricInput({ value: '92%', trend: '+1%', category: 'header_stat' }, false)).toEqual({ ok: false, error: 'label is required' })
    expect(parseMetricInput({ label: 'Attendance', value: '92%', trend: '+1%' }, false)).toEqual({ ok: false, error: 'category is required' })
    expect(parseMetricInput({ label: 'Attendance', value: 92, trend: '+1%', category: 'quality_stat', chartData: [10, '120', -5] }, false))
      .toEqual({ ok: true, value: { label: 'Attendance', value: '92', trend: '+1%', category: 'quality_stat', chartData: [10, 100, 0] } })
  })
  it('rejects unknown categories, long values and non-numeric chart data', () => {
    expect(parseMetricInput({ label: 'a', value: 'b', trend: 'c', category: 'other' }, false).ok).toBe(false)
    expect(parseMetricInput({ value: 'x'.repeat(51) }, true).ok).toBe(false)
    expect(parseMetricInput({ chartData: ['abc'] }, true).ok).toBe(false)
  })
  it('accepts partial updates', () => {
    expect(parseMetricInput({ value: '95%' }, true)).toEqual({ ok: true, value: { value: '95%' } })
  })
})
