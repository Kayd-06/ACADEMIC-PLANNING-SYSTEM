import { gradeAnswer, resolveMcqCorrectLetter } from './answer-grading'

describe('resolveMcqCorrectLetter', () => {
  it('extracts a bare letter', () => {
    expect(resolveMcqCorrectLetter('B', ['x', 'y', 'z', 'w'])).toBe('B')
  })

  it('extracts a letter from "Option C" style text', () => {
    expect(resolveMcqCorrectLetter('Option C', ['x', 'y', 'z', 'w'])).toBe('C')
  })

  it('extracts a letter from "(D)" style text', () => {
    expect(resolveMcqCorrectLetter('(D)', ['x', 'y', 'z', 'w'])).toBe('D')
  })

  it('falls back to matching option content case-insensitively', () => {
    expect(resolveMcqCorrectLetter('paris', ['London', 'Paris', 'Berlin', 'Rome'])).toBe('B')
  })

  it('returns null when correctAnswer matches nothing', () => {
    expect(resolveMcqCorrectLetter('not a real option', ['London', 'Paris', 'Berlin', 'Rome'])).toBeNull()
  })

  it('returns null when correctAnswer is blank', () => {
    expect(resolveMcqCorrectLetter('', ['London', 'Paris', 'Berlin', 'Rome'])).toBeNull()
  })
})

describe('gradeAnswer', () => {
  const mcq = { type: 'MCQ' as const, options: ['London', 'Paris', 'Berlin', 'Rome'], correctAnswer: 'Option B' }

  it('grades a matching MCQ letter as Correct', () => {
    expect(gradeAnswer(mcq, 'B')).toEqual({ kind: 'graded', status: 'Correct' })
  })

  it('grades a non-matching MCQ letter as Incorrect', () => {
    expect(gradeAnswer(mcq, 'A')).toEqual({ kind: 'graded', status: 'Incorrect' })
  })

  it('is case-insensitive on the submitted letter', () => {
    expect(gradeAnswer(mcq, 'b')).toEqual({ kind: 'graded', status: 'Correct' })
  })

  it('grades a blank MCQ answer as Unattempted', () => {
    expect(gradeAnswer(mcq, '')).toEqual({ kind: 'graded', status: 'Unattempted' })
    expect(gradeAnswer(mcq, '   ')).toEqual({ kind: 'graded', status: 'Unattempted' })
  })

  it('flags an MCQ question as unresolvable when correctAnswer matches nothing', () => {
    const badMcq = { type: 'MCQ' as const, options: ['London', 'Paris', 'Berlin', 'Rome'], correctAnswer: 'garbage' }
    expect(gradeAnswer(badMcq, 'A')).toEqual({ kind: 'unresolvable' })
  })

  it('grades Numerical within a 0.01 tolerance as Correct', () => {
    const q = { type: 'Numerical' as const, options: [], correctAnswer: '42' }
    expect(gradeAnswer(q, '42.0')).toEqual({ kind: 'graded', status: 'Correct' })
    expect(gradeAnswer(q, '42.005')).toEqual({ kind: 'graded', status: 'Correct' })
  })

  it('grades Numerical outside tolerance as Incorrect', () => {
    const q = { type: 'Integer' as const, options: [], correctAnswer: '42' }
    expect(gradeAnswer(q, '43')).toEqual({ kind: 'graded', status: 'Incorrect' })
  })

  it('falls back to string match when Numerical sides are non-numeric', () => {
    const q = { type: 'Numerical' as const, options: [], correctAnswer: 'pi' }
    expect(gradeAnswer(q, 'PI')).toEqual({ kind: 'graded', status: 'Correct' })
    expect(gradeAnswer(q, 'e')).toEqual({ kind: 'graded', status: 'Incorrect' })
  })

  it('grades a blank Numerical answer as Unattempted', () => {
    const q = { type: 'Integer' as const, options: [], correctAnswer: '42' }
    expect(gradeAnswer(q, '')).toEqual({ kind: 'graded', status: 'Unattempted' })
  })

  it('always skips Subjective questions', () => {
    const q = { type: 'Subjective' as const, options: [], correctAnswer: 'anything' }
    expect(gradeAnswer(q, 'a whole essay')).toEqual({ kind: 'skipped' })
    expect(gradeAnswer(q, '')).toEqual({ kind: 'skipped' })
  })
})
