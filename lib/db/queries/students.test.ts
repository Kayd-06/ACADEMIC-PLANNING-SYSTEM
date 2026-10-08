import { eq } from 'drizzle-orm'
import { db } from '../index'
import { students, schools, batches } from '../schema'
import {
  listStudents,
  findStudentsByClasses,
  countStudentsByClasses,
  deleteStudentsByClasses,
  getStudentById,
  createStudent as _createStudent,
  bulkInsertStudents as _bulkInsertStudents,
  upsertStudentByRollClassSection as _upsertStudentByRollClassSection,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  findStudentsByBatch,
  findStudentsByBatchId,
} from './students'

describe('students queries', () => {
  // Scoped-by-ID cleanup only — never db.delete(students)/db.delete(schools) with no WHERE
  // (both are DB-Guard-protected tables; an unscoped delete silently no-ops and leaks fixtures).
  const createdStudentIds: string[] = []
  const createdSchoolIds: string[] = []
  const createdBatchIds: string[] = []

  async function createStudent(...args: Parameters<typeof _createStudent>) {
    const s = await _createStudent(...args)
    createdStudentIds.push(s.id)
    return s
  }

  async function bulkInsertStudents(...args: Parameters<typeof _bulkInsertStudents>) {
    const rows = await _bulkInsertStudents(...args)
    createdStudentIds.push(...rows.map((r) => r.id))
    return rows
  }

  async function upsertStudentByRollClassSection(...args: Parameters<typeof _upsertStudentByRollClassSection>) {
    const s = await _upsertStudentByRollClassSection(...args)
    createdStudentIds.push(s.id)
    return s
  }

  // Every query is school-scoped now (a missing school matches nothing), so
  // fixtures live in a dedicated school created per test.
  let SCHOOL: string
  beforeEach(async () => {
    const [school] = await db.insert(schools).values({}).returning()
    SCHOOL = school.id
    createdSchoolIds.push(school.id)
  })

  afterEach(async () => {
    for (const id of createdStudentIds) await db.delete(students).where(eq(students.id, id))
    createdStudentIds.length = 0
    for (const id of createdSchoolIds) await db.delete(schools).where(eq(schools.id, id))
    createdSchoolIds.length = 0
    for (const id of createdBatchIds) await db.delete(batches).where(eq(batches.id, id))
    createdBatchIds.length = 0
  })

  it('createStudent inserts a row with defaults applied', async () => {
    const student = await createStudent({ name: 'Test Student', schoolId: SCHOOL })
    expect(student.name).toBe('Test Student')
    expect(student.rollNo).toBe('')
    expect(student.isActive).toBe(true)
  })

  it('createStudent applies empty-string defaults to program and batch', async () => {
    const student = await createStudent({ name: 'No Program Set', schoolId: SCHOOL })
    expect(student.program).toBe('')
    expect(student.batch).toBe('')
  })

  it('createStudent persists explicit program and batch values', async () => {
    const student = await createStudent({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning', schoolId: SCHOOL })
    expect(student.program).toBe('JEE 2026')
    expect(student.batch).toBe('Morning')
  })

  it('getStudentById returns the created row', async () => {
    const created = await createStudent({ name: 'Lookup Me', schoolId: SCHOOL })
    const found = await getStudentById(created.id, SCHOOL)
    expect(found?.name).toBe('Lookup Me')
  })

  it('getStudentById returns null for an unknown id', async () => {
    const found = await getStudentById('00000000-0000-0000-0000-000000000000', SCHOOL)
    expect(found).toBeNull()
  })

  it('listStudents defaults to active-only and sorts by class/section/rollNo', async () => {
    await createStudent({ name: 'Inactive One', isActive: false, schoolId: SCHOOL })
    await createStudent({ name: 'Active One', class: '11 - A', rollNo: '002', schoolId: SCHOOL })
    await createStudent({ name: 'Active Two', class: '11 - A', rollNo: '001', schoolId: SCHOOL })

    const result = await listStudents({ schoolId: SCHOOL })
    expect(result.map((s) => s.name)).toEqual(['Active Two', 'Active One'])
  })

  it('listStudents can filter by class', async () => {
    await createStudent({ name: 'In Class', class: '10 - B', schoolId: SCHOOL })
    await createStudent({ name: 'Other Class', class: '11 - A', schoolId: SCHOOL })

    const result = await listStudents({ class: '10 - B', schoolId: SCHOOL })
    expect(result.map((s) => s.name)).toEqual(['In Class'])
  })

  it('findStudentsByClasses returns active students in the given classes, sorted by rollNo/name', async () => {
    await createStudent({ name: 'Zed', class: '11 - A', rollNo: '001', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Amy', class: '11 - A', rollNo: '002', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Skipped', class: '10 - A', rollNo: '003', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Inactive', class: '11 - A', rollNo: '004', isActive: false, schoolId: SCHOOL })

    const result = await findStudentsByClasses(['11 - A'], true, SCHOOL)
    expect(result.map((s) => s.name)).toEqual(['Zed', 'Amy'])
  })

  it('countStudentsByClasses counts regardless of active status', async () => {
    await createStudent({ name: 'A', class: '11 - B', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'B', class: '11 - B', isActive: false, schoolId: SCHOOL })

    const count = await countStudentsByClasses(['11 - B'], SCHOOL)
    expect(count).toBe(2)
  })

  it('deleteStudentsByClasses removes only matching rows', async () => {
    await createStudent({ name: 'Keep', class: '10 - A', schoolId: SCHOOL })
    await createStudent({ name: 'Remove', class: '10 - B', schoolId: SCHOOL })

    await deleteStudentsByClasses(['10 - B'], SCHOOL)

    const remaining = await listStudents({ activeOnly: false, schoolId: SCHOOL })
    expect(remaining.map((s) => s.name)).toEqual(['Keep'])
  })

  it('bulkInsertStudents inserts every row and returns them', async () => {
    const result = await bulkInsertStudents([
      { name: 'Bulk One', schoolId: SCHOOL },
      { name: 'Bulk Two', schoolId: SCHOOL },
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
      schoolId: SCHOOL,
    })
    expect(result.name).toBe('New Upsert')
  })

  it('upsertStudentByRollClassSection updates the existing row on a second call', async () => {
    await upsertStudentByRollClassSection({ name: 'First Name', rollNo: '11A-002', class: '11 - A', schoolId: SCHOOL })
    const updated = await upsertStudentByRollClassSection({ name: 'Updated Name', rollNo: '11A-002', class: '11 - A', schoolId: SCHOOL })

    const all = await listStudents({ activeOnly: false, class: '11 - A', schoolId: SCHOOL })
    expect(all).toHaveLength(1)
    expect(updated.name).toBe('Updated Name')
  })

  it('updateStudent updates the given fields', async () => {
    const created = await createStudent({ name: 'Before', schoolId: SCHOOL })
    const updated = await updateStudent(created.id, { name: 'After' }, SCHOOL)
    expect(updated?.name).toBe('After')
  })

  it('updateStudent returns null for an unknown id', async () => {
    const result = await updateStudent('00000000-0000-0000-0000-000000000000', { name: 'X' }, SCHOOL)
    expect(result).toBeNull()
  })

  it('deleteStudent removes the row', async () => {
    const created = await createStudent({ name: 'To Delete', schoolId: SCHOOL })
    await deleteStudent(created.id, SCHOOL)
    const found = await getStudentById(created.id, SCHOOL)
    expect(found).toBeNull()
  })

  it('deleteAllStudents empties only the given school', async () => {
    await createStudent({ name: 'One', schoolId: SCHOOL })
    await createStudent({ name: 'Two', schoolId: SCHOOL })
    await deleteAllStudents(SCHOOL)
    const result = await listStudents({ activeOnly: false, schoolId: SCHOOL })
    expect(result).toEqual([])
  })

  it('findStudentsByBatch returns only active students in that batch, sorted by roll number then name', async () => {
    await createStudent({ name: 'Zoe', rollNo: '002', batch: 'Batch A', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Amit', rollNo: '001', batch: 'Batch A', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Different Batch', rollNo: '003', batch: 'Batch B', isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Inactive', rollNo: '004', batch: 'Batch A', isActive: false, schoolId: SCHOOL })

    const results = await findStudentsByBatch('Batch A', SCHOOL)
    expect(results.map(s => s.name)).toEqual(['Amit', 'Zoe'])
  })

  it('findStudentsByBatch scopes to the given schoolId when provided', async () => {
    const [schoolA] = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000a1' as any }).returning()
    const [schoolB] = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000b1' as any }).returning()
    createdSchoolIds.push(schoolA.id, schoolB.id)

    await createStudent({ name: 'School A Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000a1' as any })
    await createStudent({ name: 'School B Student', batch: 'Batch A', schoolId: '00000000-0000-0000-0000-0000000000b1' as any })

    const results = await findStudentsByBatch('Batch A', '00000000-0000-0000-0000-0000000000a1')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('School A Student')
  })

  it('findStudentsByBatchId returns only active students in batch, sorted by roll number then name', async () => {
    const [batch] = await db.insert(batches).values({ name: 'Morning Batch', schoolId: SCHOOL }).returning()
    const [otherBatch] = await db.insert(batches).values({ name: 'Evening Batch', schoolId: SCHOOL }).returning()
    createdBatchIds.push(batch.id, otherBatch.id)

    await createStudent({ name: 'Zoe', rollNo: '002', batchId: batch.id, isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Amit', rollNo: '001', batchId: batch.id, isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Different Batch', rollNo: '003', batchId: otherBatch.id, isActive: true, schoolId: SCHOOL })
    await createStudent({ name: 'Inactive', rollNo: '004', batchId: batch.id, isActive: false, schoolId: SCHOOL })

    const results = await findStudentsByBatchId(batch.id, SCHOOL)
    expect(results.map((s) => s.name)).toEqual(['Amit', 'Zoe'])
  })

  it('findStudentsByBatchId scopes to the given schoolId when provided', async () => {
    const [schoolA] = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000a2' as any }).returning()
    const [schoolB] = await db.insert(schools).values({ id: '00000000-0000-0000-0000-0000000000b2' as any }).returning()
    createdSchoolIds.push(schoolA.id, schoolB.id)
    const [batch] = await db.insert(batches).values({ name: 'Shared Batch' }).returning()
    createdBatchIds.push(batch.id)

    await createStudent({ name: 'School A Student', batchId: batch.id, schoolId: '00000000-0000-0000-0000-0000000000a2' as any })
    await createStudent({ name: 'School B Student', batchId: batch.id, schoolId: '00000000-0000-0000-0000-0000000000b2' as any })

    const results = await findStudentsByBatchId(batch.id, '00000000-0000-0000-0000-0000000000a2')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('School A Student')
  })

  it('a missing schoolId matches no rows instead of every school', async () => {
    await createStudent({ name: 'Scoped' })
    expect(await listStudents({ schoolId: null })).toEqual([])
    expect(await findStudentsByBatch('', undefined)).toEqual([])
  })
})
