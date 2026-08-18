import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, emailVerifications, passwordResets, schools, students, studentReports, studentReportEntries, tests, questions, testGrades, batches, subjects, chapters, concepts, dailyStudentRatings, ptmReports } from './schema'

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
    await expect(db.select().from(dailyStudentRatings)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(ptmReports)).resolves.toEqual(expect.any(Array))
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

  describe('curriculum foundation', () => {
    let testSubjectId: string
    let testChapterId: string
    let testConceptId: string

    afterEach(async () => {
      if (testConceptId) await db.delete(concepts).where(eq(concepts.id, testConceptId))
      if (testChapterId) await db.delete(chapters).where(eq(chapters.id, testChapterId))
      if (testSubjectId) await db.delete(subjects).where(eq(subjects.id, testSubjectId))
      testSubjectId = ''
      testChapterId = ''
      testConceptId = ''
    })

    it('chapters accepts code and board', async () => {
      const [subject] = await db.insert(subjects).values({ name: 'Physics Foundation Test' }).returning()
      testSubjectId = subject.id
      const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Kinematics Foundation Test', code: 'PHY-01', board: 'CBSE' }).returning()
      testChapterId = chapter.id
      expect(chapter.code).toBe('PHY-01')
      expect(chapter.board).toBe('CBSE')
    })

    it('concepts links to a chapter', async () => {
      const [subject] = await db.insert(subjects).values({ name: 'Chemistry Foundation Test' }).returning()
      testSubjectId = subject.id
      const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Chemical Bonding Foundation Test' }).returning()
      testChapterId = chapter.id
      const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Ionic Bonding', code: 'CB-01' }).returning()
      testConceptId = concept.id
      expect(concept.chapterId).toBe(chapter.id)
      expect(concept.name).toBe('Ionic Bonding')
    })
  })
})
