import { buildStudentMatcher, type ExistingStudentKey } from '@/lib/students/bulkMatch'

const existing: ExistingStudentKey[] = [
  { id: 'a', rollNo: '1', class: '11', section: '', admissionNumber: 'ADM1', name: 'Asha' },
  { id: 'b', rollNo: '2', class: '11', section: 'A', admissionNumber: null, name: 'Bala' },
  { id: 'c', rollNo: '3', class: '11', section: 'A', admissionNumber: null, name: 'Chitra' },
  { id: 'd', rollNo: '3', class: '11', section: 'B', admissionNumber: null, name: 'Dev' },
  { id: 'e', rollNo: '', class: '9', section: 'B', admissionNumber: null, name: 'Esha' },
]
const match = buildStudentMatcher(existing)
const row = (o: Partial<Parameters<typeof match>[0]>) => ({
  name: 'X', rollNo: '', class: '', section: '', sectionProvided: false, admissionNumber: null, ...o,
})

describe('buildStudentMatcher', () => {
  it('matches roll+class, keeping the existing section when the file has none', () => {
    expect(match(row({ rollNo: '2', class: '11' }))).toEqual({ existingId: 'b', section: 'A', dedupeKey: 'id:b' })
  })

  it('requires the same section when the file provides one', () => {
    expect(match(row({ rollNo: '3', class: '11', section: 'B', sectionProvided: true })).existingId).toBe('d')
    expect(match(row({ rollNo: '2', class: '11', section: 'C', sectionProvided: true })).existingId).toBeNull()
  })

  it('treats several sectioned candidates as ambiguous when the file has no section', () => {
    const r = match(row({ rollNo: '3', class: '11' }))
    expect(r.existingId).toBeNull()
    expect(r.dedupeKey).toBe('rc:3|11|')
  })

  it('falls back to admission number, then name+class', () => {
    expect(match(row({ admissionNumber: 'ADM1' })).existingId).toBe('a')
    expect(match(row({ name: ' esha ', class: '9' })).existingId).toBe('e')
  })

  it('never matches or dedupes name-only rows', () => {
    expect(match(row({ name: 'Asha' }))).toEqual({ existingId: null, section: '', dedupeKey: null })
  })
})
