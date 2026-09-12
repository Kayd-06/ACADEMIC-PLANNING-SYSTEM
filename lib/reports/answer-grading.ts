export type QuestionType = 'MCQ' | 'Numerical' | 'Integer' | 'Subjective'
export type GradedStatus = 'Correct' | 'Incorrect' | 'Unattempted'

export interface GradableQuestion {
  type: QuestionType
  options: string[]
  correctAnswer: string
}

export type GradeOutcome =
  | { kind: 'graded'; status: GradedStatus }
  | { kind: 'unresolvable' }
  | { kind: 'skipped' }

const MCQ_LETTERS = ['A', 'B', 'C', 'D']
const MCQ_LETTER_PATTERNS = [/^\(?([A-D])\)?$/i, /Option\s*([A-D])/i, /Choice\s*([A-D])/i]

// A question's correct letter is a property of the question, not of any one
// student's row — the import route calls this once per question to decide
// whether it can be auto-graded at all.
export function resolveMcqCorrectLetter(correctAnswer: string, options: string[]): string | null {
  const trimmed = (correctAnswer || '').trim()
  if (!trimmed) return null

  for (const pattern of MCQ_LETTER_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) return match[1].toUpperCase()
  }

  const index = options.findIndex((opt) => (opt || '').trim().toLowerCase() === trimmed.toLowerCase())
  return index >= 0 && index < MCQ_LETTERS.length ? MCQ_LETTERS[index] : null
}

function gradeMcq(question: GradableQuestion, rawAnswer: string): GradeOutcome {
  const correctLetter = resolveMcqCorrectLetter(question.correctAnswer, question.options)
  if (!correctLetter) return { kind: 'unresolvable' }

  const submitted = (rawAnswer || '').trim().toUpperCase()
  if (!submitted) return { kind: 'graded', status: 'Unattempted' }
  return { kind: 'graded', status: submitted === correctLetter ? 'Correct' : 'Incorrect' }
}

function gradeNumeric(question: GradableQuestion, rawAnswer: string): GradeOutcome {
  const submitted = (rawAnswer || '').trim()
  if (!submitted) return { kind: 'graded', status: 'Unattempted' }

  const correctRaw = (question.correctAnswer || '').trim()
  const submittedNum = Number(submitted)
  const correctNum = Number(correctRaw)

  if (Number.isFinite(submittedNum) && Number.isFinite(correctNum)) {
    return { kind: 'graded', status: Math.abs(submittedNum - correctNum) <= 0.01 ? 'Correct' : 'Incorrect' }
  }

  const isMatch = submitted.toLowerCase() === correctRaw.toLowerCase()
  return { kind: 'graded', status: isMatch ? 'Correct' : 'Incorrect' }
}

export function gradeAnswer(question: GradableQuestion, rawAnswer: string): GradeOutcome {
  if (question.type === 'Subjective') return { kind: 'skipped' }
  if (question.type === 'MCQ') return gradeMcq(question, rawAnswer)
  return gradeNumeric(question, rawAnswer)
}
