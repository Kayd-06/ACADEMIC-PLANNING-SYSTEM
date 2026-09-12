import { MISTAKE_TYPES } from './mistake-types'

export const MAX_IMPORT_ROWS = 1000
export const RATING_VALUES = ['Unsatisfactory', 'Satisfactory', 'Good', 'Very Good', 'Excellent'] as const
export type RatingValue = typeof RATING_VALUES[number]

export interface RawImportRow {
  rollNo?: unknown
  studentName?: unknown
  answers?: Record<string, unknown>
  mistakeTypes?: Record<string, unknown>
  attitude?: unknown
  behaviour?: unknown
  focus?: unknown
  interaction?: unknown
  ptmParentAttended?: unknown
  ptmParentName?: unknown
  ptmDiscussionNotes?: unknown
  ptmActionItems?: unknown
  ptmFollowUpDate?: unknown
}

export interface ValidatedImportRow {
  rollNo: string
  answers: Record<string, string>
  mistakeTypes: Record<string, string>
  rating: { attitude: RatingValue; behaviour: RatingValue; focus: RatingValue; interaction: RatingValue } | null
  ptm: { parentAttended: boolean; parentName: string; discussionNotes: string; actionItems: string; followUpDate: string } | null
}

export interface ImportRowError {
  row: number
  rollNo: string
  field: string
  message: string
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function isTruthyYes(value: unknown): boolean {
  const normalized = text(value).toLowerCase()
  return normalized === 'yes' || normalized === 'true' || normalized === '1'
}

export function validateImportRows(
  rawRows: unknown,
  questionIds: string[]
): { validRows: ValidatedImportRow[]; rowErrors: ImportRowError[] } {
  if (!Array.isArray(rawRows)) {
    throw new Error('The import request does not contain a rows array.')
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`A single import can contain at most ${MAX_IMPORT_ROWS} rows.`)
  }

  const attachedQuestionIds = new Set(questionIds)
  const rowErrors: ImportRowError[] = []
  const validRows: ValidatedImportRow[] = []
  const seenRollNumbers = new Map<string, number>()

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2
    const row = (raw && typeof raw === 'object' ? raw : {}) as RawImportRow
    const rollNo = text(row.rollNo)

    if (!rollNo) {
      rowErrors.push({ row: rowNumber, rollNo: '', field: 'RollNo', message: 'RollNo is required.' })
      return
    }
    const normalizedRollNo = rollNo.toLowerCase()
    const earlierRow = seenRollNumbers.get(normalizedRollNo)
    if (earlierRow) {
      rowErrors.push({ row: rowNumber, rollNo, field: 'RollNo', message: `Duplicate of row ${earlierRow} in this file.` })
      return
    }
    seenRollNumbers.set(normalizedRollNo, rowNumber)

    const answers: Record<string, string> = {}
    for (const [questionId, value] of Object.entries(row.answers || {})) {
      if (attachedQuestionIds.has(questionId)) answers[questionId] = text(value)
    }

    const mistakeTypes: Record<string, string> = {}
    for (const [questionId, value] of Object.entries(row.mistakeTypes || {})) {
      if (!attachedQuestionIds.has(questionId)) continue
      const mistakeType = text(value)
      if (!mistakeType) continue
      if (!(MISTAKE_TYPES as readonly string[]).includes(mistakeType)) {
        rowErrors.push({ row: rowNumber, rollNo, field: `MistakeType (${questionId})`, message: 'Must be one of the 6 valid mistake categories.' })
        continue
      }
      mistakeTypes[questionId] = mistakeType
    }

    const ratingFields: Array<['attitude' | 'behaviour' | 'focus' | 'interaction', string]> = [
      ['attitude', text(row.attitude)],
      ['behaviour', text(row.behaviour)],
      ['focus', text(row.focus)],
      ['interaction', text(row.interaction)],
    ]
    const filledRatings = ratingFields.filter(([, value]) => value !== '')
    let rating: ValidatedImportRow['rating'] = null
    if (filledRatings.length > 0) {
      // Invalid-value errors take priority over completeness: a partially
      // filled row with a bad value should name the bad field, not just
      // say "fill in all four".
      const invalid = filledRatings.find(([, value]) => !(RATING_VALUES as readonly string[]).includes(value))
      if (invalid) {
        const label = invalid[0][0].toUpperCase() + invalid[0].slice(1)
        rowErrors.push({ row: rowNumber, rollNo, field: label, message: `Must be one of: ${RATING_VALUES.join(', ')}` })
      } else if (filledRatings.length !== 4) {
        rowErrors.push({ row: rowNumber, rollNo, field: 'Behavioral ratings', message: 'Fill in all four of Attitude, Behaviour, Focus, Interaction, or leave all four blank.' })
      } else {
        // Each value already passed the RATING_VALUES.includes check above,
        // so the cast to RatingValue is safe — TS can't narrow through .find().
        rating = {
          attitude: ratingFields[0][1] as RatingValue,
          behaviour: ratingFields[1][1] as RatingValue,
          focus: ratingFields[2][1] as RatingValue,
          interaction: ratingFields[3][1] as RatingValue,
        }
      }
    }

    const parentAttended = isTruthyYes(row.ptmParentAttended)
    const discussionNotes = text(row.ptmDiscussionNotes)
    const ptm = (text(row.ptmParentAttended) !== '' || discussionNotes !== '')
      ? {
          parentAttended,
          parentName: text(row.ptmParentName),
          discussionNotes,
          actionItems: text(row.ptmActionItems),
          followUpDate: text(row.ptmFollowUpDate),
        }
      : null

    validRows.push({ rollNo, answers, mistakeTypes, rating, ptm })
  })

  return { validRows, rowErrors }
}
