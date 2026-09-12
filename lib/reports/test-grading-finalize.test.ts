import { db } from '@/lib/db'
import { tests, testGrades, users, students } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { finalizeGradedTest } from './test-grading-finalize'

jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn() }))
import { notifyRoleInSchool } from '@/lib/notify'

describe('finalizeGradedTest', () => {
  const createdTestIds: string[] = []
  const createdUserIds: string[] = []
  const createdStudentIds: string[] = []

  afterEach(async () => {
    for (const id of createdTestIds) await db.delete(testGrades).where(eq(testGrades.testId, id))
    for (const id of createdTestIds) await db.delete(tests).where(eq(tests.id, id))
    createdTestIds.length = 0
    for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id))
    createdUserIds.length = 0
    for (const id of createdStudentIds) await db.delete(students).where(eq(students.id, id))
    createdStudentIds.length = 0
    ;(notifyRoleInSchool as jest.Mock).mockClear()
  })

  async function createOwner() {
    const [owner] = await db.insert(users).values({
      name: 'Finalize Owner', email: `finalize-${Date.now()}@example.com`, password: 'x', role: 'teacher',
    }).returning()
    createdUserIds.push(owner.id)
    return owner
  }

  async function createTest(ownerId: string) {
    const [test] = await db.insert(tests).values({
      title: 'Finalize Test', batch: 'Finalize Batch', subject: 'Physics', date: '2026-01-01', totalMarks: 100, createdByUserId: ownerId, status: 'Pending Grading',
    }).returning()
    createdTestIds.push(test.id)
    return test
  }

  async function createStudent(rollNo: string) {
    const [s] = await db.insert(students).values({ name: `Student ${rollNo}`, rollNo, batch: 'Finalize Batch', isActive: true }).returning()
    createdStudentIds.push(s.id)
    return s
  }

  it('computes averageScore from present students only, sets status to Graded, and notifies', async () => {
    const owner = await createOwner()
    const test = await createTest(owner.id)
    const s1 = await createStudent('1')
    const s2 = await createStudent('2')
    const s3 = await createStudent('3')

    await db.insert(testGrades).values([
      { testId: test.id, studentId: s1.id, rollNo: '1', marksObtained: 80, correct: 2, incorrect: 0, unattempted: 0, absent: false, gradedByUserId: owner.id },
      { testId: test.id, studentId: s2.id, rollNo: '2', marksObtained: 40, correct: 1, incorrect: 1, unattempted: 0, absent: false, gradedByUserId: owner.id },
      { testId: test.id, studentId: s3.id, rollNo: '3', marksObtained: 0, correct: 0, incorrect: 0, unattempted: 0, absent: true, gradedByUserId: owner.id },
    ])

    const { updatedTest, averageScore } = await finalizeGradedTest(test)

    expect(averageScore).toBe(60) // (80% + 40%) / 2, absent row excluded
    expect(updatedTest.status).toBe('Graded')
    expect(updatedTest.averageScore).toBe(60)
    expect(notifyRoleInSchool).toHaveBeenCalledTimes(1)
    expect(notifyRoleInSchool).toHaveBeenCalledWith(
      ['teacher', 'management'],
      test.schoolId,
      expect.objectContaining({ category: 'Result', title: expect.stringContaining(test.title) }),
      expect.any(Function)
    )
  })

  it('leaves averageScore null when every student is absent', async () => {
    const owner = await createOwner()
    const test = await createTest(owner.id)
    const s1 = await createStudent('1')

    await db.insert(testGrades).values([
      { testId: test.id, studentId: s1.id, rollNo: '1', marksObtained: 0, correct: 0, incorrect: 0, unattempted: 0, absent: true, gradedByUserId: owner.id },
    ])

    const { averageScore } = await finalizeGradedTest(test)
    expect(averageScore).toBeNull()
  })
})
