import { getDailyRatingsForBatchAndDate, getStudentDailyRatingsSummary } from './daily-ratings'

describe('daily-ratings queries', () => {
  it('handles empty ratings list gracefully', async () => {
    const summary = await getStudentDailyRatingsSummary('00000000-0000-0000-0000-000000000000')
    expect(summary.totalEntries).toBe(0)
    expect(summary.avgAttitude).toBe(0)
    expect(summary.avgBehaviour).toBe(0)
    expect(summary.avgFocus).toBe(0)
    expect(summary.avgInteraction).toBe(0)
    expect(summary.overallRatingScore).toBe(0)
    expect(summary.ratingsList).toEqual([])
  })

  it('returns empty array when no ratings exist for batch and date', async () => {
    const ratings = await getDailyRatingsForBatchAndDate('NonExistentBatch', '2026-01-01')
    expect(ratings).toEqual([])
  })
})
