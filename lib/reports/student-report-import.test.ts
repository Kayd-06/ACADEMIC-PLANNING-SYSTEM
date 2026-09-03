import {
  gradeFor,
  StudentReportImportValidationError,
  validateStudentReportImport,
} from './student-report-import'

describe('student report import validation', () => {
  it('normalizes rows and calculates grades on the server', () => {
    const result = validateStudentReportImport({
      className: ' Grade 10-A ',
      subject: ' Physics ',
      term: ' Mid-Term ',
      sourceFileName: ' marks.xlsx ',
      entries: [{ name: ' Rahul ', rollNo: ' 101 ', marks: '75', maxMarks: '100', attendance: '95', remarks: ' Good ' }],
    })

    expect(result.className).toBe('Grade 10-A')
    expect(result.sourceFileName).toBe('marks.xlsx')
    expect(result.entries[0]).toEqual({
      name: 'Rahul', rollNo: '101', marks: 75, maxMarks: 100,
      grade: 'B', attendance: 95, remarks: 'Good',
    })
  })

  it.each([
    [95, 100, 'A+'], [85, 100, 'A'], [75, 100, 'B'],
    [65, 100, 'C'], [55, 100, 'D'], [45, 100, 'F'],
  ])('grades %s/%s as %s', (marks, maxMarks, grade) => {
    expect(gradeFor(marks, maxMarks)).toBe(grade)
  })

  it('rejects missing metadata and empty sheets', () => {
    expect(() => validateStudentReportImport({ entries: [] })).toThrow(StudentReportImportValidationError)
  })

  it('reports spreadsheet row numbers for invalid values', () => {
    try {
      validateStudentReportImport({
        className: '10-A', subject: 'Math', term: 'Final',
        entries: [{ name: '', rollNo: '', marks: 110, maxMarks: 100, attendance: 101 }],
      })
      throw new Error('Expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(StudentReportImportValidationError)
      const validationError = error as StudentReportImportValidationError
      expect(validationError.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 2, field: 'Name' }),
        expect.objectContaining({ row: 2, field: 'RollNo' }),
        expect.objectContaining({ row: 2, field: 'Marks' }),
        expect.objectContaining({ row: 2, field: 'Attendance' }),
      ]))
    }
  })
})
