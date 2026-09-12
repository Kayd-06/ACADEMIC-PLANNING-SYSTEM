import { validateImportRows, MAX_IMPORT_ROWS, RATING_VALUES } from './test-results-import'

const Q1 = 'q1-uuid'
const Q2 = 'q2-uuid'
const questionIds = [Q1, Q2]

describe('validateImportRows', () => {
  it('accepts a fully-populated row', () => {
    const { validRows, rowErrors } = validateImportRows([
      {
        rollNo: '101',
        answers: { [Q1]: 'B', [Q2]: '42' },
        mistakeTypes: { [Q2]: 'Calculation Error' },
        attitude: 'Good', behaviour: 'Excellent', focus: 'Good', interaction: 'Very Good',
        ptmParentAttended: 'Yes', ptmParentName: 'Mr. Sharma', ptmDiscussionNotes: 'Discussed progress', ptmActionItems: 'Practice more', ptmFollowUpDate: '2026-10-01',
      },
    ], questionIds)

    expect(rowErrors).toEqual([])
    expect(validRows).toHaveLength(1)
    expect(validRows[0]).toEqual({
      rollNo: '101',
      answers: { [Q1]: 'B', [Q2]: '42' },
      mistakeTypes: { [Q2]: 'Calculation Error' },
      rating: { attitude: 'Good', behaviour: 'Excellent', focus: 'Good', interaction: 'Very Good' },
      ptm: { parentAttended: true, parentName: 'Mr. Sharma', discussionNotes: 'Discussed progress', actionItems: 'Practice more', followUpDate: '2026-10-01' },
    })
  })

  it('requires a RollNo', () => {
    const { rowErrors } = validateImportRows([{ rollNo: '' }], questionIds)
    expect(rowErrors).toEqual([{ row: 2, rollNo: '', field: 'RollNo', message: 'RollNo is required.' }])
  })

  it('rejects an invalid rating value but keeps the row for grading', () => {
    const { validRows, rowErrors } = validateImportRows([
      { rollNo: '101', attitude: 'Amazing' },
    ], questionIds)
    expect(rowErrors).toEqual([{ row: 2, rollNo: '101', field: 'Attitude', message: `Must be one of: ${RATING_VALUES.join(', ')}` }])
    expect(validRows[0].rating).toBeNull()
  })

  it('treats ratings as all-or-nothing: any three filled without the fourth is an error', () => {
    const { rowErrors } = validateImportRows([
      { rollNo: '101', attitude: 'Good', behaviour: 'Good', focus: 'Good' },
    ], questionIds)
    expect(rowErrors).toEqual([{ row: 2, rollNo: '101', field: 'Behavioral ratings', message: 'Fill in all four of Attitude, Behaviour, Focus, Interaction, or leave all four blank.' }])
  })

  it('treats all four ratings blank as no rating for that row (not an error)', () => {
    const { validRows, rowErrors } = validateImportRows([{ rollNo: '101' }], questionIds)
    expect(rowErrors).toEqual([])
    expect(validRows[0].rating).toBeNull()
  })

  it('rejects an invalid mistake type', () => {
    const { rowErrors } = validateImportRows([
      { rollNo: '101', mistakeTypes: { [Q1]: 'Bad Handwriting' } },
    ], questionIds)
    expect(rowErrors).toEqual([{ row: 2, rollNo: '101', field: `MistakeType (${Q1})`, message: 'Must be one of the 6 valid mistake categories.' }])
  })

  it('ignores an answer for a question ID not attached to this test', () => {
    const { validRows, rowErrors } = validateImportRows([
      { rollNo: '101', answers: { 'unattached-question-id': 'A' } },
    ], questionIds)
    expect(rowErrors).toEqual([])
    expect(validRows[0].answers).toEqual({})
  })

  it('treats PTM as populated only when parentAttended or discussionNotes is non-blank', () => {
    const { validRows } = validateImportRows([{ rollNo: '101' }], questionIds)
    expect(validRows[0].ptm).toBeNull()
  })

  it('flags duplicate roll numbers within the same file', () => {
    const { rowErrors } = validateImportRows([{ rollNo: '101' }, { rollNo: '101' }], questionIds)
    expect(rowErrors).toEqual([{ row: 3, rollNo: '101', field: 'RollNo', message: 'Duplicate of row 2 in this file.' }])
  })

  it('throws when given more than MAX_IMPORT_ROWS rows', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ({ rollNo: String(i) }))
    expect(() => validateImportRows(rows, questionIds)).toThrow(`A single import can contain at most ${MAX_IMPORT_ROWS} rows.`)
  })

  it('throws when rawRows is not an array', () => {
    expect(() => validateImportRows({ not: 'an array' }, questionIds)).toThrow('The import request does not contain a rows array.')
  })
})
