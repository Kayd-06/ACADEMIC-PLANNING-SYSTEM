import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  schools,
  students,
  tests,
  questions,
  testQuestionResponses,
  testGrades,
  dailyStudentRatings,
  ptmReports,
} from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/reports/students/x') as any
}

function call(studentId: string) {
  return GET(req(), { params: Promise.resolve({ id: studentId }) })
}

describe('GET /api/reports/students/[id]', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    tests: [] as string[],
    questions: [] as string[],
    responses: [] as string[],
    grades: [] as string[],
    ratings: [] as string[],
    ptm: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.responses) await db.delete(testQuestionResponses).where(eq(testQuestionResponses.id, id))
    for (const id of createdIds.grades) await db.delete(testGrades).where(eq(testGrades.id, id))
    for (const id of createdIds.ratings) await db.delete(dailyStudentRatings).where(eq(dailyStudentRatings.id, id))
    for (const id of createdIds.ptm) await db.delete(ptmReports).where(eq(ptmReports.id, id))
    for (const id of createdIds.questions) await db.delete(questions).where(eq(questions.id, id))
    for (const id of createdIds.tests) await db.delete(tests).where(eq(tests.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
    jest.clearAllMocks()
  })

  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await call('00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(401)
  })

  it('returns 404 when the student belongs to a different school than the caller', async () => {
    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    const [schoolB] = await db.insert(schools).values({ name: 'School B' }).returning()
    createdIds.schools.push(schoolA.id, schoolB.id)

    const [student] = await db.insert(students).values({
      name: 'Cross Tenant Student', schoolId: schoolB.id, batch: 'X',
    }).returning()
    createdIds.students.push(student.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const res = await call(student.id)
    expect(res.status).toBe(404)
  })

  it('computes rank, percentile, topPercent, subject breakdown and real guardian fields from parentContact, excluding same-batch students from other schools', async () => {
    const batch = `RANK-BATCH-${Date.now()}-${Math.random()}`

    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    const [schoolB] = await db.insert(schools).values({ name: 'School B' }).returning()
    createdIds.schools.push(schoolA.id, schoolB.id)

    const [target] = await db.insert(students).values({
      name: 'Target Student', schoolId: schoolA.id, batch, rollNo: '101',
      parentContact: 'parent@example.com', phone: '9999999999',
    }).returning()
    const [peer] = await db.insert(students).values({
      name: 'Peer Student', schoolId: schoolA.id, batch,
    }).returning()
    // Same batch name, but a DIFFERENT school — must not affect target's rank.
    const [outsider] = await db.insert(students).values({
      name: 'Outsider Student', schoolId: schoolB.id, batch,
    }).returning()
    createdIds.students.push(target.id, peer.id, outsider.id)

    const [test] = await db.insert(tests).values({
      title: 'Unit Test 1', batch, subject: 'Physics', date: '2026-08-01', schoolId: schoolA.id,
    }).returning()
    createdIds.tests.push(test.id)

    const [question] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Motion', text: 'What is F=ma?', marks: 4, schoolId: schoolA.id,
    }).returning()
    createdIds.questions.push(question.id)

    // Target scores higher than peer -> rank 1 in its own school.
    const [targetGrade] = await db.insert(testGrades).values({
      testId: test.id, studentId: target.id, marksObtained: 80, schoolId: schoolA.id,
    }).returning()
    const [peerGrade] = await db.insert(testGrades).values({
      testId: test.id, studentId: peer.id, marksObtained: 40, schoolId: schoolA.id,
    }).returning()
    // Outsider has the highest marks, but belongs to a different school+same batch name.
    const [outsiderGrade] = await db.insert(testGrades).values({
      testId: test.id, studentId: outsider.id, marksObtained: 100, schoolId: schoolB.id,
    }).returning()
    createdIds.grades.push(targetGrade.id, peerGrade.id, outsiderGrade.id)

    const [response] = await db.insert(testQuestionResponses).values({
      testId: test.id, questionId: question.id, studentId: target.id, status: 'Correct', marksAwarded: 4, schoolId: schoolA.id,
    }).returning()
    createdIds.responses.push(response.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const res = await call(target.id)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.student.guardianName).toBe('parent@example.com')
    expect(body.student.guardianPhone).toBe('9999999999')

    // Only target + peer belong to schoolA, so despite the outsider's higher
    // score, target (80) ranks #1 of 2 in its own school's batch.
    expect(body.performanceReport.rank).toBe(1)
    expect(body.performanceReport.totalStudentsInBatch).toBe(2)
    expect(body.performanceReport.percentile).toBe(50)
    expect(body.performanceReport.topPercent).toBe(50)

    expect(body.performanceReport.subjectBreakdown).toEqual([
      { subject: 'Physics', marksObtained: 4, maxMarks: 4, percentage: 100 },
    ])
  })

  it('aggregates daily ratings and PTM attendance into teacherFeedbackSummary', async () => {
    const [school] = await db.insert(schools).values({ name: 'Feedback School' }).returning()
    createdIds.schools.push(school.id)

    const [student] = await db.insert(students).values({
      name: 'Feedback Student', schoolId: school.id, batch: 'FB-BATCH',
    }).returning()
    createdIds.students.push(student.id)

    const [rating] = await db.insert(dailyStudentRatings).values({
      studentId: student.id, batch: 'FB-BATCH', date: '2026-08-01',
      attitude: 'Excellent', behaviour: 'Excellent', focus: 'Excellent', interaction: 'Excellent',
      schoolId: school.id,
    }).returning()
    createdIds.ratings.push(rating.id)

    const [ptmAttended] = await db.insert(ptmReports).values({
      studentId: student.id, date: '2026-08-05', parentAttended: true, schoolId: school.id,
    }).returning()
    const [ptmMissed] = await db.insert(ptmReports).values({
      studentId: student.id, date: '2026-08-10', parentAttended: false, schoolId: school.id,
    }).returning()
    createdIds.ptm.push(ptmAttended.id, ptmMissed.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const res = await call(student.id)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.teacherFeedbackSummary.dailyRatingsCount).toBe(1)
    expect(body.teacherFeedbackSummary.ratings.behavioralScore).toBe(5)
    expect(body.teacherFeedbackSummary.ptm.totalMeetings).toBe(2)
    expect(body.teacherFeedbackSummary.ptm.attendanceRate).toBe(50)
  })
})
