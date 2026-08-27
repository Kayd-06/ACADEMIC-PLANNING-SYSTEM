import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  schools,
  students,
  tests,
  questions,
  testQuestionResponses,
  testGrades,
  chapters,
  subjects,
  batches,
  batchSyllabus,
  attendanceSessions,
  attendanceEntries,
} from '@/lib/db/schema'
import { computeStudentAnalytics } from './student-analytics'

describe('computeStudentAnalytics', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    tests: [] as string[],
    questions: [] as string[],
    responses: [] as string[],
    grades: [] as string[],
    subjects: [] as string[],
    chapters: [] as string[],
    batches: [] as string[],
    batchSyllabus: [] as string[],
    attendanceSessions: [] as string[],
    attendanceEntries: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.attendanceEntries) await db.delete(attendanceEntries).where(eq(attendanceEntries.id, id))
    for (const id of createdIds.attendanceSessions) await db.delete(attendanceSessions).where(eq(attendanceSessions.id, id))
    for (const id of createdIds.batchSyllabus) await db.delete(batchSyllabus).where(eq(batchSyllabus.id, id))
    for (const id of createdIds.responses) await db.delete(testQuestionResponses).where(eq(testQuestionResponses.id, id))
    for (const id of createdIds.grades) await db.delete(testGrades).where(eq(testGrades.id, id))
    for (const id of createdIds.questions) await db.delete(questions).where(eq(questions.id, id))
    for (const id of createdIds.tests) await db.delete(tests).where(eq(tests.id, id))
    for (const id of createdIds.chapters) await db.delete(chapters).where(eq(chapters.id, id))
    for (const id of createdIds.subjects) await db.delete(subjects).where(eq(subjects.id, id))
    for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
  })

  it('filters responses and grades by tests.date when a range is provided', async () => {
    const batch = `RANGE-BATCH-${Date.now()}`
    const [school] = await db.insert(schools).values({ name: 'Range School' }).returning()
    createdIds.schools.push(school.id)

    const [student] = await db.insert(students).values({
      name: 'Range Student', schoolId: school.id, batch,
    }).returning()
    createdIds.students.push(student.id)

    const [inRangeTest] = await db.insert(tests).values({
      title: 'In Range Test', batch, subject: 'Physics', date: '2026-06-15', schoolId: school.id,
    }).returning()
    const [outOfRangeTest] = await db.insert(tests).values({
      title: 'Out Of Range Test', batch, subject: 'Physics', date: '2026-01-01', schoolId: school.id,
    }).returning()
    createdIds.tests.push(inRangeTest.id, outOfRangeTest.id)

    const [question] = await db.insert(questions).values({
      subject: 'Physics', topic: 'Motion', text: 'Q1', marks: 4, schoolId: school.id,
    }).returning()
    createdIds.questions.push(question.id)

    const [inRangeResponse] = await db.insert(testQuestionResponses).values({
      testId: inRangeTest.id, questionId: question.id, studentId: student.id, status: 'Correct', marksAwarded: 4, schoolId: school.id,
    }).returning()
    const [outOfRangeResponse] = await db.insert(testQuestionResponses).values({
      testId: outOfRangeTest.id, questionId: question.id, studentId: student.id, status: 'Incorrect', marksAwarded: 0, schoolId: school.id,
    }).returning()
    createdIds.responses.push(inRangeResponse.id, outOfRangeResponse.id)

    const [inRangeGrade] = await db.insert(testGrades).values({
      testId: inRangeTest.id, studentId: student.id, marksObtained: 4, schoolId: school.id,
    }).returning()
    const [outOfRangeGrade] = await db.insert(testGrades).values({
      testId: outOfRangeTest.id, studentId: student.id, marksObtained: 0, schoolId: school.id,
    }).returning()
    createdIds.grades.push(inRangeGrade.id, outOfRangeGrade.id)

    const result = await computeStudentAnalytics(student.id, school.id, { fromDate: '2026-06-01', toDate: '2026-06-30' })

    expect(result!.testAnalysisReport.totalQuestions).toBe(1)
    expect(result!.performanceReport.totalMarksObtained).toBe(4)
    expect(result!.performanceReport.totalMarksAttempted).toBe(4)
  })

  it('computes attendance percentage from Present/Absent entries in range', async () => {
    const [school] = await db.insert(schools).values({ name: 'Attendance School' }).returning()
    createdIds.schools.push(school.id)

    const [student] = await db.insert(students).values({
      name: 'Attendance Student', schoolId: school.id, batch: 'ATT-BATCH',
    }).returning()
    createdIds.students.push(student.id)

    const [session1] = await db.insert(attendanceSessions).values({
      date: '2026-06-05', batch: 'ATT-BATCH', subject: 'Physics', schoolId: school.id,
    }).returning()
    const [session2] = await db.insert(attendanceSessions).values({
      date: '2026-06-06', batch: 'ATT-BATCH', subject: 'Physics', schoolId: school.id,
    }).returning()
    createdIds.attendanceSessions.push(session1.id, session2.id)

    const [entry1] = await db.insert(attendanceEntries).values({
      sessionId: session1.id, studentId: student.id, studentName: student.name, status: 'Present',
    }).returning()
    const [entry2] = await db.insert(attendanceEntries).values({
      sessionId: session2.id, studentId: student.id, studentName: student.name, status: 'Absent',
    }).returning()
    createdIds.attendanceEntries.push(entry1.id, entry2.id)

    const result = await computeStudentAnalytics(student.id, school.id, { fromDate: '2026-06-01', toDate: '2026-06-30' })

    expect(result!.attendance.totalSessions).toBe(2)
    expect(result!.attendance.presentCount).toBe(1)
    expect(result!.attendance.percentage).toBe(50)
  })

  it("computes per-subject chapter coverage from batchSyllabus for the student's batchId", async () => {
    const [school] = await db.insert(schools).values({ name: 'Coverage School' }).returning()
    createdIds.schools.push(school.id)

    const [batch] = await db.insert(batches).values({
      name: `COV-BATCH-${Date.now()}`, schoolId: school.id,
    }).returning()
    createdIds.batches.push(batch.id)

    const [student] = await db.insert(students).values({
      name: 'Coverage Student', schoolId: school.id, batch: batch.name, batchId: batch.id,
    }).returning()
    createdIds.students.push(student.id)

    const [subject] = await db.insert(subjects).values({ name: 'Chemistry', schoolId: school.id }).returning()
    createdIds.subjects.push(subject.id)

    const [chapter1] = await db.insert(chapters).values({
      subjectId: subject.id, name: 'Atomic Structure', schoolId: school.id,
    }).returning()
    const [chapter2] = await db.insert(chapters).values({
      subjectId: subject.id, name: 'Chemical Bonding', schoolId: school.id,
    }).returning()
    createdIds.chapters.push(chapter1.id, chapter2.id)

    const [syllabus1] = await db.insert(batchSyllabus).values({
      batchId: batch.id, chapterId: chapter1.id, status: 'Completed',
    }).returning()
    const [syllabus2] = await db.insert(batchSyllabus).values({
      batchId: batch.id, chapterId: chapter2.id, status: 'In Progress',
    }).returning()
    createdIds.batchSyllabus.push(syllabus1.id, syllabus2.id)

    const result = await computeStudentAnalytics(student.id, school.id)

    const chemistryCoverage = result!.subjectCoverage.find((s) => s.subject === 'Chemistry')
    expect(chemistryCoverage).toEqual({
      subject: 'Chemistry',
      totalChaptersTaught: 2,
      completedChaptersCount: 1,
      conceptsTotalCount: 0,
      conceptsMasteredCount: 0,
    })
  })
})
