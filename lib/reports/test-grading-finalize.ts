import { eq } from 'drizzle-orm'
import { db, tests, testGrades, type Test } from '@/lib/db'
import { notifyRoleInSchool } from '@/lib/notify'

// Recomputes the test's averageScore from its testGrades cache, flips it to
// Graded, and notifies teacher/management. Both the manual per-question
// grading route and the bulk CSV import route call this — it is the one
// place that decides what "a test just got graded" means.
export async function finalizeGradedTest(test: Test): Promise<{ updatedTest: Test; averageScore: number | null }> {
  const savedGrades = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
  const presentPercentages = savedGrades
    .filter((g) => !g.absent && g.marksObtained !== null)
    .map((g) => ((g.marksObtained as number) / test.totalMarks) * 100)
  const averageScore = presentPercentages.length > 0
    ? Math.round(presentPercentages.reduce((sum, p) => sum + p, 0) / presentPercentages.length)
    : null

  const [updatedTest] = await db.update(tests)
    .set({ averageScore, status: 'Graded', updatedAt: new Date() })
    .where(eq(tests.id, test.id))
    .returning()

  await notifyRoleInSchool(
    ['teacher', 'management'],
    test.schoolId,
    {
      category: 'Result',
      title: `Test Results Declared: ${test.title}`,
      message: `Results for Subject: ${test.subject} (Batch: ${test.batch}) have been declared.${averageScore !== null ? ` Class Average: ${averageScore}%.` : ''}`,
    },
    (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
  )

  return { updatedTest, averageScore }
}
