import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, emailVerifications, passwordResets, schools, students, studentReports, studentReportEntries, tests, questions, testGrades, batches } from './schema'

describe('schema', () => {
  it('can query all tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(passwordResets)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(students)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReports)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReportEntries)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(tests)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(questions)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(testGrades)).resolves.toEqual(expect.any(Array))
  })

  describe('batch integrity', () => {
    let testSchoolId: string
    let testBatchId: string
    let testStudentId: string
    let testTestId: string

    afterEach(async () => {
      // Delete in reverse order of FK dependencies.
      if (testTestId) await db.delete(tests).where(eq(tests.id, testTestId))
      if (testStudentId) await db.delete(students).where(eq(students.id, testStudentId))
      if (testBatchId) await db.delete(batches).where(eq(batches.id, testBatchId))
      if (testSchoolId) await db.delete(schools).where(eq(schools.id, testSchoolId))
      testSchoolId = ''
      testBatchId = ''
      testStudentId = ''
      testTestId = ''
    })

    it('students accepts batchId', async () => {
      const [school] = await db.insert(schools).values({ name: 'Test School' }).returning()
      testSchoolId = school.id
      const [batch] = await db.insert(batches).values({ name: 'Batch A', schoolId: school.id }).returning()
      testBatchId = batch.id
      const [student] = await db.insert(students).values({ name: 'Test Student', batch: 'Batch A', batchId: batch.id, schoolId: school.id }).returning()
      testStudentId = student.id
      expect(student.batchId).toBe(batch.id)
    })

    it('tests accepts batchId', async () => {
      const [school] = await db.insert(schools).values({ name: 'Test School' }).returning()
      testSchoolId = school.id
      const [batch] = await db.insert(batches).values({ name: 'Batch A', schoolId: school.id }).returning()
      testBatchId = batch.id
      const [test] = await db.insert(tests).values({ title: 'Linked Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', batchId: batch.id, schoolId: school.id }).returning()
      testTestId = test.id
      expect(test.batchId).toBe(batch.id)
    })
  })
})
