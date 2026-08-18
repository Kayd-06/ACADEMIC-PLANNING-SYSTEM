import { listPtmReports, getStudentPtmSummary } from './ptm-reports'

describe('ptm-reports queries', () => {
  it('handles empty PTM reports list gracefully', async () => {
    const summary = await getStudentPtmSummary('00000000-0000-0000-0000-000000000000')
    expect(summary.totalMeetings).toBe(0)
    expect(summary.parentsAttendedCount).toBe(0)
    expect(summary.attendanceRate).toBe(0)
    expect(summary.ptmList).toEqual([])
  })

  it('returns empty array when searching non-existent filters', async () => {
    const reports = await listPtmReports({ studentId: '00000000-0000-0000-0000-000000000000' })
    expect(reports).toEqual([])
  })
})
