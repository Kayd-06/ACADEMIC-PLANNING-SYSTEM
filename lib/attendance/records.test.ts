import { unknownStudentIds, validateAttendanceRecords } from '@/lib/attendance/records'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('validateAttendanceRecords', () => {
  it('rejects a non-UUID studentId with a clear message (was a 500)', () => {
    const r = validateAttendanceRecords([{ studentId: 'abc', studentName: 'X', status: 'Present' }])
    expect(r).toEqual({ ok: false, error: 'Record 1: studentId is not a valid id.' })
  })

  it('rejects unknown statuses and missing names', () => {
    expect(validateAttendanceRecords([{ studentName: 'X', status: 'Here' }]).ok).toBe(false)
    expect(validateAttendanceRecords([{ studentName: ' ' }]).ok).toBe(false)
    expect(validateAttendanceRecords('nope').ok).toBe(false)
  })

  it('rejects over-long fields instead of failing in the database', () => {
    expect(validateAttendanceRecords([{ studentName: 'X', notes: 'n'.repeat(501) }]).ok).toBe(false)
    expect(validateAttendanceRecords([{ studentName: 'X', rollNo: 'r'.repeat(101) }]).ok).toBe(false)
  })

  it('keeps the last record per student and defaults status to Absent', () => {
    const r = validateAttendanceRecords([
      { studentId: A, studentName: 'Asha', status: 'Present' },
      { studentId: B, studentName: 'Bala' },
      { studentId: A.toUpperCase(), studentName: 'Asha', status: 'Late' },
      { studentName: 'Walk-in' },
    ])
    if (!r.ok) throw new Error(r.error)
    expect(r.studentIds).toEqual([B, A])
    expect(r.records.map((x) => [x.studentName, x.status])).toEqual([['Bala', 'Absent'], ['Asha', 'Late'], ['Walk-in', 'Absent']])
  })
})

describe('unknownStudentIds', () => {
  it('lists ids that are not in the caller\'s school', () => {
    expect(unknownStudentIds([A, B], [A.toUpperCase()])).toEqual([B])
    expect(unknownStudentIds([A], [A])).toEqual([])
  })
})
