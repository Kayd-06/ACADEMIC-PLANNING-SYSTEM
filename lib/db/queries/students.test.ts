import { db } from '../index'
import { students, schools } from '../schema'
import {
  listStudents,
  findStudentsByClasses,
  countStudentsByClasses,
  deleteStudentsByClasses,
  getStudentById,
  createStudent,
  bulkInsertStudents,
  upsertStudentByRollClassSection,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  findStudentsByBatch,
} from './students'

describe('students queries', () => {
  afterEach(async () => {
    await db.delete(students)
    await db.delete(schools)
  })

  it('createStudent inserts a row with defaults applied', async () => {
    const student = await createStudent({ name: 'Test Student' })
    expect(student.name).toBe('Test Student')
    expect(student.rollNo).toBe('')
    expect(student.isActive).toBe(true)
  })

  it('createStudent applies empty-string defaults to program and batch', async () => {
    const student = await createStudent({ name: 'No Program Set' })
    expect(student.program).toBe('')
    expect(student.batch).toBe('')
  })

  it('createStudent persists explicit program and batch values', async () => {
    const student = await createStudent({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning' })
    expect(student.program).toBe('JEE 2026')
    expect(student.batch).toBe('Morning')
  })

  it('getStudentById returns the created row', async () => {
    const created = await createStudent({ name: 'Lookup Me' })
    const found = await getStudentById(created.id)
    expect(found?.name).toBe('Lookup Me')
  })

  it('getStudentById returns null for an unknown id', async () => {
    const found = await getStudentById('00000000-0000-0000-0000-000000000000')
    expect(found).toBeNull()
  })

  it('listStudents defaults to active-only and sorts by class/section/rollNo', async () => {
    await createStudent({ name: 'Inactive One', isActive: false })
    await createStudent({ name: 'Active One', class: '11 - A', rollNo: '002' })
    await createStudent({ name: 'Active Two', class: '11 - A', rollNo: '001' })

    const result = await listStudents()
    expect(result.map((s) => s.name)).toEqual(['Active Two', 'Active One'])
  })

  it('listStudents can filter by class', async () => {
    await createStudent({ name: 'In Class', class: '10 - B' })
    await createStudent({ name: 'Other Class', class: '11 - A' })

    const result = await listStudents({ class: '10 - B' })
    expect(result.map((s) => s.name)).toEqual(['In Class'])
  })

  it('findStudentsByClasses returns active students in the given classes, sorted by rollNo/name', async () => {
    await createStudent({ name: 'Zed', class: '11 - A', rollNo: '001', isActive: true })
    await createStudent({ name: 'Amy', class: '11 - A', rollNo: '002', isActive: true })
    await createStudent({ name: 'Skipped', class: '10 - A', rollNo: '003', isActive: true })
    await createStudent({ name: 'Inactive', class: '11 - A', rollNo: '004', isActive: false })

    const result = await findStudentsByClasses(['11 - A'])
    expect(result.map((s) => s.name)).toEqual(['Zed', 'Amy'])
  })

  it('countStudentsByClasses counts regardless of active status', async () => {
    await createStudent({ name: 'A', class: '11 - B', isActive: true })
    await createStudent({ name: 'B', class: '11 - B', isActive: false })

    const count = await countStudentsByClasses(['11 - B'])
    expect(count).toBe(2)
  })

  it('deleteStudentsByClasses removes only matching rows', async () => {
    await createStudent({ name: 'Keep', class: '10 - A' })
    await createStudent({ name: 'Remove', class: '10 - B' })

    await deleteStudentsByClasses(['10 - B'])

    const remaining = await listStudents({ activeOnly: false })
    expect(remaining.map((s) => s.name)).toEqual(['Keep'])
  })

  it('bulkInsertStudents inserts every row and returns them', async () => {
    const result = await bulkInsertStudents([
      { name: 'Bulk One' },
      { name: 'Bulk Two' },
    ])
    expect(result).toHaveLength(2)
  })

  it('bulkInsertStudents returns an empty array for an empty input', async () => {
    const result = await bulkInsertStudents([])
    expect(result).toEqual([])
  })

  it('upsertStudentByRollClassSection inserts when no match exists', async () => {
    const result = await upsertStudentByRollClassSection({
      name: 'New Upsert',
      rollNo: '11A-001',
      class: '11 - A',
    })
    expect(result.name).toBe('New Upsert')
  })

  it('upsertStudentByRollClassSection updates the existing row on a second call', async () => {
    await upsertStudentByRollClassSection({ name: 'First Name', rollNo: '11A-002', class: '11 - A' })
    const updated = await upsertStudentByRollClassSection({ name: 'Updated Name', rollNo: '11A-002', class: '11 - A' })

    const all = await listStudents({ activeOnly: false, class: '11 - A' })
    expect(all).toHaveLength(1)
    expect(updated.name).toBe('Updated Name')
  })

  it('updateStudent updates the given fields', async () => {
    const created = await createStudent({ name: 'Before' })
    const updated = await updateStudent(created.id, { name: 'After' })
    expect(updated?.name).toBe('After')
  })

  it('updateStudent returns null for an unknown id', async () => {
    const result = await updateStudent('00000000-0000-0000-0000-000000000000', { name: 'X' })
    expect(result).toBeNull()
  })

  it('deleteStudent removes the row', async () => {
    const created = await createStudent({ name: 'To Delete' })
    await deleteStudent(created.id)
    const found = await getStudentById(created.id)
    expect(found).toBeNull()
  })

  it('deleteAllStudents empties the table', async () => {
    await createStudent({ name: 'One' })
    await createStudent({ name: 'Two' })
    await deleteAllStudents()
    const result = await listStudents({ activeOnly: false })
    expect(result).toEqual([])
  })

  it('findStudentsByBatch returns only active students in that batch, sorted by roll number then name', async () => {
    await createStudent({ name: 'Zoe', rollNo: '002', batch: 'Batch A', isActive: true })
    await createStudent({ name: 'Amit', rollNo: '001', batch: 'Batch A', isActive: true })
    await createStudent({ name: 'Different Batch', rollNo: '003', batch: 'Batch B', isActive: true })
    await createStudent({ name: 'Inactive', rollNo: '004', batch: 'Batch A', isActive: false })

    const results = await findStudentsByBatch('Batch A')
    expect(results.map(s => s.name)).toEqual(['Amit', 'Zoe'])
  })

  it('findStudentsByBatch scopes to the given schoolId when provided', async () => {
    const schoolA = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000a1' as any }).returning()
    const schoolB = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000b1' as any }).returning()

    await createStudent({ name: 'School A Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000a1' as any })
    await createStudent({ name: 'School B Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000b1' as any })

    const results = await findStudentsByBatch('Batch A', '00000000-0000-0000-0000-0000000000a1')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('School A Student')
  })
})
