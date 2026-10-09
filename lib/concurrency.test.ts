import { chunk, mapWithConcurrency } from '@/lib/concurrency'

describe('chunk', () => {
  it('splits into fixed-size chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(() => chunk([1], 0)).toThrow()
  })
})

describe('mapWithConcurrency', () => {
  it('never exceeds the limit and preserves order', async () => {
    let inFlight = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
      if (n === 4) throw new Error('boom')
      return n * 10
    })
    expect(peak).toBeLessThanOrEqual(3)
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : 'err'))).toEqual([10, 20, 30, 'err', 50, 60, 70])
  })
})
