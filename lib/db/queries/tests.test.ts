import { db } from '../index'
import { tests, testGrades, students } from '../schema'
import { computeTestPerformance } from './tests'

describe('computeTestPerformance', () => {
  afterEach(async () => {
    await db.delete(testGrades)
    await db.delete(tests)
    await db.delete(students)
  })

  it('returns an empty list for a student with no grades', async () => {
    const result = await computeTestPerformance('00000000-0000-0000-0000-000000000000', null)
    expect(result).toEqual([])
  })

  it('returns graded entries ordered by date descending, with a computed percentage', async () => {
    const [student] = await db.insert(students).values({ name: 'Perf Student', batch: 'Batch A' }).returning()
    const [testEarly] = await db.insert(tests).values({ title: 'Early Test', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    const [testLate] = await db.insert(tests).values({ title: 'Late Test', batch: 'Batch A', subject: 'Chemistry', date: '2026-07-01', totalMarks: 50 }).returning()
    await db.insert(testGrades).values([
      { testId: testEarly.id, studentId: student.id, marksObtained: 80, absent: false },
      { testId: testLate.id, studentId: student.id, marksObtained: 25, absent: false },
    ])

    const result = await computeTestPerformance(student.id, null)
    expect(result.map(r => r.title)).toEqual(['Late Test', 'Early Test'])
    expect(result[0].percentage).toBe(50)
    expect(result[1].percentage).toBe(80)
  })

  it('reports absent entries with a null percentage', async () => {
    const [student] = await db.insert(students).values({ name: 'Absent Student', batch: 'Batch A' }).returning()
    const [test] = await db.insert(tests).values({ title: 'Missed Test', batch: 'Batch A', subject: 'Physics', date: '2026-06-01', totalMarks: 100 }).returning()
    await db.insert(testGrades).values({ testId: test.id, studentId: student.id, absent: true })

    const result = await computeTestPerformance(student.id, null)
    expect(result).toHaveLength(1)
    expect(result[0].absent).toBe(true)
    expect(result[0].percentage).toBeNull()
  })
})
