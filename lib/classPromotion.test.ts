import {
  computeBoundaryDate,
  subtractOneYear,
  computeAcademicYearLabel,
  isEligibleForPromotion,
  buildPreviewCounts,
} from './classPromotion'

describe('computeBoundaryDate', () => {
  it("returns this year's boundary when today is on or after the start month", () => {
    const today = new Date(Date.UTC(2027, 5, 15)) // June 2027, start month April (4)
    expect(computeBoundaryDate(4, today)).toBe('2027-04-01')
  })

  it("returns last year's boundary when today is before the start month", () => {
    const today = new Date(Date.UTC(2027, 1, 10)) // February 2027, start month April (4)
    expect(computeBoundaryDate(4, today)).toBe('2026-04-01')
  })

  it('handles a January start month', () => {
    const today = new Date(Date.UTC(2027, 0, 1)) // Jan 1, 2027
    expect(computeBoundaryDate(1, today)).toBe('2027-01-01')
  })
})

describe('subtractOneYear', () => {
  it('subtracts one year from a YYYY-MM-DD date', () => {
    expect(subtractOneYear('2027-04-01')).toBe('2026-04-01')
  })
})

describe('computeAcademicYearLabel', () => {
  it('builds a YYYY-YYYY label from the boundary date', () => {
    expect(computeAcademicYearLabel('2027-04-01')).toBe('2027-2028')
  })
})

describe('isEligibleForPromotion', () => {
  const previousBoundaryDate = '2026-04-01'

  it('is eligible when admitted before the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-03-31', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(true)
  })

  it('is NOT eligible when admitted exactly on the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-04-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible when admitted one day after the previous boundary', () => {
    const student = { class: '9', admissionDate: '2026-04-02', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is eligible with a null admissionDate (pre-existing data with no recorded date)', () => {
    const student = { class: '9', admissionDate: null, isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(true)
  })

  it('is NOT eligible for Class 12 (terminal, no next class)', () => {
    const student = { class: '12', admissionDate: '2020-01-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible for Repeater', () => {
    const student = { class: 'Repeater', admissionDate: '2020-01-01', isActive: true }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })

  it('is NOT eligible when inactive', () => {
    const student = { class: '9', admissionDate: '2020-01-01', isActive: false }
    expect(isEligibleForPromotion(student, previousBoundaryDate)).toBe(false)
  })
})

describe('buildPreviewCounts', () => {
  it('groups eligible students by fromClass -> toClass -> count', () => {
    const eligible = [{ class: '9' }, { class: '9' }, { class: '10' }]
    expect(buildPreviewCounts(eligible)).toEqual({ '9': { '10': 2 }, '10': { '11': 1 } })
  })

  it('returns an empty object for no eligible students', () => {
    expect(buildPreviewCounts([])).toEqual({})
  })
})
