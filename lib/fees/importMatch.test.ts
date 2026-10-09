import { buildFeeStudentMatcher, importReceiptNumber, occurrenceCounter, type FeeImportStudent } from './importMatch'

const s = (id: string, rollNo: string, cls: string, section: string, name: string, adm: string | null = null): FeeImportStudent =>
  ({ id, rollNo, class: cls, section, name, admissionNumber: adm })

const students = [
  s('a', '1', '10', 'A', 'Asha', 'ADM-1'),
  s('b', '1', '10', 'B', 'Bina', 'ADM-2'),
  s('c', '1', '9', 'A', 'Asha'),
  s('d', '7', '9', 'A', 'Dev'),
]
const match = buildFeeStudentMatcher(students)
const id = (r: ReturnType<typeof match>) => (r.kind === 'matched' ? r.student.id : r.kind)

describe('buildFeeStudentMatcher', () => {
  it('prefers the admission number', () => {
    expect(id(match({ admissionNumber: 'adm-2', rollNo: '1' }))).toBe('b')
  })
  it('matches roll + class + section', () => {
    expect(id(match({ rollNo: '1', class: '10', section: 'B' }))).toBe('b')
    expect(id(match({ rollNo: '1', class: '9' }))).toBe('c')
  })
  it('never picks the first of several students sharing a roll number', () => {
    expect(match({ rollNo: '1' })).toMatchObject({ kind: 'ambiguous' })
    expect(match({ rollNo: '1', class: '10' })).toMatchObject({ kind: 'ambiguous' })
  })
  it('accepts a bare roll number only when it is unique in the school', () => {
    expect(id(match({ rollNo: '7' }))).toBe('d')
  })
  it('falls back to a unique name, and reports duplicate names', () => {
    expect(id(match({ name: 'dev' }))).toBe('d')
    expect(match({ name: 'Asha' })).toMatchObject({ kind: 'ambiguous' })
  })
  it('leaves unknown students unmatched', () => {
    expect(match({ rollNo: '99', class: '10', name: 'Nobody' })).toEqual({ kind: 'unmatched' })
  })
})

describe('importReceiptNumber', () => {
  const parts = { schoolId: 'sch', student: 'a', fee: 'f1', dueDate: '2026-04-05', paidDate: '', amountDue: 1000, amountPaid: 0 }
  it('is stable across imports so re-imports update instead of duplicating', () => {
    expect(importReceiptNumber(parts, 0)).toBe(importReceiptNumber({ ...parts }, 0))
    expect(importReceiptNumber(parts, 0)).toMatch(/^IMP-[0-9A-F]{24}$/)
  })
  it('differs for a different payment, school or occurrence', () => {
    const base = importReceiptNumber(parts, 0)
    expect(importReceiptNumber({ ...parts, amountPaid: 500 }, 0)).not.toBe(base)
    expect(importReceiptNumber({ ...parts, dueDate: '2026-05-05' }, 0)).not.toBe(base)
    expect(importReceiptNumber({ ...parts, schoolId: 'other' }, 0)).not.toBe(base)
    expect(importReceiptNumber(parts, 1)).not.toBe(base)
  })
  it('counts identical rows within one file', () => {
    const next = occurrenceCounter()
    expect(next(parts)).toBe(0)
    expect(next(parts)).toBe(1)
    expect(next({ ...parts, amountDue: 5 })).toBe(0)
  })
})
