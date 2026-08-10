import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, emailVerifications, passwordResets, schools, students, studentReports, studentReportEntries, tests, questions, testGrades, batches, chapters, subjects, concepts } from './schema'

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

  describe('batch curriculum foundation', () => {
    it('students accepts batchId', async () => {
      const [school] = await db.insert(schools).values({ name: 'Test School' }).returning()
      const [batch] = await db.insert(batches).values({ name: 'Batch A', schoolId: school.id }).returning()
      const [student] = await db.insert(students).values({ name: 'Test Student', batch: 'Batch A', batchId: batch.id, schoolId: school.id }).returning()
      expect(student.batchId).toBe(batch.id)
    })

    it('tests accepts batchId', async () => {
      const [school] = await db.insert(schools).values({ name: 'Test School' }).returning()
      const [batch] = await db.insert(batches).values({ name: 'Batch A', schoolId: school.id }).returning()
      const [test] = await db.insert(tests).values({ title: 'Linked Test', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', batchId: batch.id, schoolId: school.id }).returning()
      expect(test.batchId).toBe(batch.id)
    })

    it('chapters accepts code board', async () => {
      const [subject] = await db.insert(subjects).values({ name: 'Physics Foundation Test' }).returning()
      const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Kinematics', code: 'PHY-01', board: 'CBSE' }).returning()
      expect(chapter.code).toBe('PHY-01')
      expect(chapter.board).toBe('CBSE')
    })

    it('concepts links chapter', async () => {
      const [subject] = await db.insert(subjects).values({ name: 'Chemistry Foundation Test' }).returning()
      const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Chemical Bonding' }).returning()
      const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Ionic Bonding', code: 'CB-01' }).returning()
      expect(concept.chapterId).toBe(chapter.id)
      expect(concept.name).toBe('Ionic Bonding')
    })
  })
})
