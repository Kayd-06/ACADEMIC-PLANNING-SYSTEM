export const MAX_REPORT_IMPORT_ROWS = 1000

export interface StudentReportImportRow {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number | null
  remarks: string | null
}

export interface StudentReportImportData {
  className: string
  subject: string
  term: string
  sourceFileName: string | null
  entries: StudentReportImportRow[]
}

export interface StudentReportImportRowError {
  row: number
  field: string
  message: string
}

export class StudentReportImportValidationError extends Error {
  errors: StudentReportImportRowError[]

  constructor(message: string, errors: StudentReportImportRowError[] = []) {
    super(message)
    this.name = 'StudentReportImportValidationError'
    this.errors = errors
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

export function gradeFor(marks: number, maxMarks: number): string {
  const percentage = (marks / maxMarks) * 100
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B'
  if (percentage >= 60) return 'C'
  if (percentage >= 50) return 'D'
  return 'F'
}

export function validateStudentReportImport(body: unknown): StudentReportImportData {
  if (!body || typeof body !== 'object') {
    throw new StudentReportImportValidationError('Invalid import request.')
  }

  const input = body as Record<string, unknown>
  const className = cleanText(input.className, 255)
  const subject = cleanText(input.subject, 255)
  const term = cleanText(input.term, 255)
  const sourceFileName = cleanText(input.sourceFileName, 255) || null
  const rawEntries = Array.isArray(input.entries)
    ? input.entries
    : Array.isArray(input.students)
      ? input.students
      : []

  const metadataErrors: string[] = []
  if (!className) metadataErrors.push('Class is required.')
  if (!subject) metadataErrors.push('Subject is required.')
  if (!term) metadataErrors.push('Term is required.')
  if (rawEntries.length === 0) metadataErrors.push('The spreadsheet does not contain any student rows.')
  if (rawEntries.length > MAX_REPORT_IMPORT_ROWS) {
    metadataErrors.push(`A single import can contain at most ${MAX_REPORT_IMPORT_ROWS} rows.`)
  }
  if (metadataErrors.length > 0) {
    throw new StudentReportImportValidationError(metadataErrors.join(' '))
  }

  const errors: StudentReportImportRowError[] = []
  const seenRollNumbers = new Map<string, number>()
  const entries = rawEntries.map((raw, index): StudentReportImportRow => {
    const rowNumber = index + 2
    const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const name = cleanText(row.name, 255)
    const rollNo = cleanText(row.rollNo, 255)
    const remarks = cleanText(row.remarks, 1000) || null
    const marks = readNumber(row.marks)
    const maxMarks = readNumber(row.maxMarks)
    const hasAttendance = row.attendance !== null && row.attendance !== undefined && row.attendance !== ''
    const attendance = !hasAttendance
      ? null
      : readNumber(row.attendance)

    if (!name) errors.push({ row: rowNumber, field: 'Name', message: 'Name is required.' })
    if (!rollNo) errors.push({ row: rowNumber, field: 'RollNo', message: 'RollNo is required.' })
    if (rollNo) {
      const normalizedRollNo = rollNo.toLowerCase()
      const earlierRow = seenRollNumbers.get(normalizedRollNo)
      if (earlierRow) {
        errors.push({ row: rowNumber, field: 'RollNo', message: `Duplicate RollNo; it was already used on row ${earlierRow}.` })
      } else {
        seenRollNumbers.set(normalizedRollNo, rowNumber)
      }
    }
    if (marks === null || !Number.isInteger(marks) || marks < 0) {
      errors.push({ row: rowNumber, field: 'Marks', message: 'Marks must be a whole number of 0 or more.' })
    }
    if (maxMarks === null || !Number.isInteger(maxMarks) || maxMarks <= 0) {
      errors.push({ row: rowNumber, field: 'MaxMarks', message: 'MaxMarks must be a whole number greater than 0.' })
    }
    if (marks !== null && maxMarks !== null && marks > maxMarks) {
      errors.push({ row: rowNumber, field: 'Marks', message: 'Marks cannot be greater than MaxMarks.' })
    }
    if (hasAttendance && (attendance === null || !Number.isInteger(attendance) || attendance < 0 || attendance > 100)) {
      errors.push({ row: rowNumber, field: 'Attendance', message: 'Attendance must be a whole number from 0 to 100.' })
    }

    const safeMarks = marks ?? 0
    const safeMaxMarks = maxMarks && maxMarks > 0 ? maxMarks : 100
    return {
      name,
      rollNo,
      marks: safeMarks,
      maxMarks: safeMaxMarks,
      grade: gradeFor(safeMarks, safeMaxMarks),
      attendance: attendance !== null && Number.isInteger(attendance) ? attendance : null,
      remarks,
    }
  })

  if (errors.length > 0) {
    throw new StudentReportImportValidationError(
      `Fix ${errors.length} spreadsheet ${errors.length === 1 ? 'error' : 'errors'} and try again.`,
      errors.slice(0, 100)
    )
  }

  return { className, subject, term, sourceFileName, entries }
}
