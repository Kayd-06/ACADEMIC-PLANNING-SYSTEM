import { findRollKeyConflicts, findTooLongField, mergeStudentRow, type StoredStudent } from './bulkRow'

const stored: StoredStudent = {
  name: 'Asha Rao', rollNo: '12', class: '10', section: 'A', program: 'Science', batch: 'B1',
  batchId: 'b1', parentContact: '9999999999', status: 'inactive', isActive: false,
  admissionNumber: 'ADM-1', email: 'asha@example.com', city: 'Pune',
}

describe('mergeStudentRow', () => {
  it('a Name + Admission Number re-import keeps every stored value and the inactive status', () => {
    const m = mergeStudentRow(stored, { name: 'Asha Rao', optional: { admissionNumber: 'ADM-1' } })
    expect(m).toMatchObject({
      rollNo: '12', class: '10', section: 'A', program: 'Science', batch: 'B1', batchId: 'b1',
      parentContact: '9999999999', status: 'inactive', isActive: false,
    })
    expect(m.optional).toMatchObject({ admissionNumber: 'ADM-1', email: 'asha@example.com', city: 'Pune' })
  })

  it('empty / whitespace cells never overwrite', () => {
    const m = mergeStudentRow(stored, { name: 'Asha', class: '  ', program: '', parentContact: '', status: '', optional: { email: ' ' } })
    expect(m.class).toBe('10')
    expect(m.program).toBe('Science')
    expect(m.parentContact).toBe('9999999999')
    expect(m.optional.email).toBe('asha@example.com')
    expect(m.isActive).toBe(false)
  })

  it('provided cells overwrite, and the batch id follows the batch cell', () => {
    const m = mergeStudentRow(stored, { name: 'Asha R', class: '11', batch: 'B2', batchId: 'b2', optional: { city: 'Mumbai' } })
    expect(m).toMatchObject({ name: 'Asha R', class: '11', batch: 'B2', batchId: 'b2' })
    expect(m.optional.city).toBe('Mumbai')
  })

  it('only an explicit Status cell changes active status', () => {
    expect(mergeStudentRow(stored, { name: 'Asha', status: 'active' })).toMatchObject({ status: 'active', isActive: true })
    const active = { ...stored, status: 'active', isActive: true }
    expect(mergeStudentRow(active, { name: 'Asha', status: 'Inactive' })).toMatchObject({ isActive: false })
    expect(mergeStudentRow(active, { name: 'Asha' })).toMatchObject({ status: 'active', isActive: true })
  })

  it('new students get defaults', () => {
    const m = mergeStudentRow(null, { name: ' New ', rollNo: '1' })
    expect(m).toMatchObject({ name: 'New', rollNo: '1', class: '', section: '', program: '', batchId: null, status: 'active', isActive: true })
    expect(m.optional.email).toBeNull()
  })
})

describe('findTooLongField', () => {
  it('flags values over the column limit', () => {
    expect(findTooLongField({ name: 'a', pincode: '1'.repeat(21) })).toEqual({ field: 'pincode', limit: 20 })
    expect(findTooLongField({ name: 'a', notes: 'x'.repeat(5000) })).toBeNull()
  })
})

describe('findRollKeyConflicts', () => {
  const existing = [{ id: 's1', rollNo: '1', class: '10', section: 'A' }]
  it('allows a student keeping its own key', () => {
    expect(findRollKeyConflicts([{ index: 0, id: 's1', rollNo: '1', class: '10', section: 'A' }], existing).size).toBe(0)
  })
  it('reports a row taking another student\'s key', () => {
    const c = findRollKeyConflicts([{ index: 3, id: 's2', rollNo: '1', class: '10', section: 'A' }], existing)
    expect(c.get(3)).toMatch(/Another student already has roll number 1/)
  })
  it('reports two rows of the file claiming the same key, keeping the first', () => {
    const c = findRollKeyConflicts([
      { index: 0, id: 'n1', rollNo: '5', class: '9', section: '' },
      { index: 1, id: 's1', rollNo: '5', class: '9', section: '' },
    ], existing)
    expect([...c.keys()]).toEqual([1])
  })
  it('ignores rows without roll number or class', () => {
    expect(findRollKeyConflicts([{ index: 0, id: 'x', rollNo: '', class: '10', section: 'A' }], existing).size).toBe(0)
  })
})
