import { MISTAKE_TYPES } from './mistake-types'

describe('MISTAKE_TYPES', () => {
  it('lists the six mistake categories shared by manual grading and CSV import', () => {
    expect(MISTAKE_TYPES).toEqual([
      'Calculation Error',
      'Conceptual Error',
      'Formula Error',
      'Silly Mistake',
      'Time Management',
      'Other',
    ])
  })
})
