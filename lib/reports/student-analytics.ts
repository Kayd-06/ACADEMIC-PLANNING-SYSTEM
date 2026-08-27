import { db } from '@/lib/db'
import {
  students,
  testGrades,
  tests,
  testQuestionResponses,
  questions,
  chapters,
  concepts,
  dailyStudentRatings,
  ptmReports,
  subjects,
  batchSyllabus,
  attendanceEntries,
  attendanceSessions,
} from '@/lib/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'

export interface SubjectBreakdownEntry {
  subject: string
  marksObtained: number
  maxMarks: number
  percentage: number
}

export interface ChapterBreakdownEntry {
  chapter: string
  subject: string
  correct: number
  total: number
  accuracy: number
}

export interface TopicMasteryEntry {
  topic: string
  mastery: number
  category: 'Chapter' | 'Concept'
  parent: string
}

export interface StudentAnalyticsRange {
  fromDate: string
  toDate: string
}

export interface SubjectCoverageEntry {
  subject: string
  totalChaptersTaught: number
  completedChaptersCount: number
  conceptsTotalCount: number
  conceptsMasteredCount: number
}

export interface StudentAnalyticsResult {
  student: {
    id: string
    name: string
    rollNo: string
    batch: string
    programName: string
    guardianName: string
    guardianPhone: string
  }
  performanceReport: {
    overallPercentage: number
    overallGrade: string
    totalMarksObtained: number
    totalMarksAttempted: number
    rank: number
    totalStudentsInBatch: number
    percentile: number
    topPercent: number
    subjectBreakdown: SubjectBreakdownEntry[]
    chapterBreakdown: ChapterBreakdownEntry[]
  }
  testAnalysisReport: {
    totalQuestions: number
    questionsAttempted: number
    questionsCorrect: number
    questionsIncorrect: number
    questionsUnattempted: number
    accuracyRate: number
    attemptRate: number
    questionTypeBreakdown: Array<{ type: string; total: number; correct: number; accuracy: number }>
    difficultyBreakdown: Array<{ difficulty: string; total: number; correct: number; accuracy: number }>
  }
  strengthVsWeaknessMap: {
    strongTopics: TopicMasteryEntry[]
    averageTopics: TopicMasteryEntry[]
    weakTopics: TopicMasteryEntry[]
  }
  errorLogs: {
    mistakeTypeSummary: Record<string, number>
    recentErrors: Array<{
      id: string
      testTitle: string
      questionText: string
      chapterTitle: string
      mistakeType: string
      date: string | Date | null
    }>
  }
  attendance: {
    percentage: number
    presentCount: number
    totalSessions: number
  }
  subjectCoverage: SubjectCoverageEntry[]
  teacherFeedbackSummary: {
    dailyRatingsCount: number
    ratings: {
      attitude: number
      behaviour: number
      focus: number
      interaction: number
      behavioralScore: number
    }
    ptm: {
      totalMeetings: number
      attendanceRate: number
      recentLogs: Array<{
        id: string
        date: string | null
        parentName: string | null
        parentAttended: boolean
        discussionNotes: string | null
        actionItems: string | null
        followUpDate: string | null
      }>
    }
  }
}

export async function computeStudentAnalytics(
  studentId: string,
  schoolId: string | null,
  range?: StudentAnalyticsRange,
): Promise<StudentAnalyticsResult | null> {
  // 1. Fetch Student Details, scoped to the caller's school
  const studentConditions = [eq(students.id, studentId)]
  if (schoolId) studentConditions.push(eq(students.schoolId, schoolId))
  const [student] = await db.select().from(students).where(and(...studentConditions))
  if (!student) return null

  // 2. Fetch All Test Responses for the Student
  const responseConditions = [eq(testQuestionResponses.studentId, studentId)]
  if (range) {
    responseConditions.push(gte(tests.date, range.fromDate))
    responseConditions.push(lte(tests.date, range.toDate))
  }
  const responses = await db
    .select({
      responseId: testQuestionResponses.id,
      testId: testQuestionResponses.testId,
      questionId: testQuestionResponses.questionId,
      status: testQuestionResponses.status,
      mistakeType: testQuestionResponses.mistakeType,
      marksAwarded: testQuestionResponses.marksAwarded,
      testTitle: tests.title,
      testDate: tests.createdAt,
      questionText: questions.text,
      questionType: questions.type,
      difficulty: questions.difficulty,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      subjectName: questions.subject,
      chapterId: questions.chapterId,
      conceptId: questions.conceptId,
      chapterName: chapters.name,
      conceptName: concepts.name,
    })
    .from(testQuestionResponses)
    .innerJoin(tests, eq(tests.id, testQuestionResponses.testId))
    .innerJoin(questions, eq(questions.id, testQuestionResponses.questionId))
    .leftJoin(chapters, eq(chapters.id, questions.chapterId))
    .leftJoin(concepts, eq(concepts.id, questions.conceptId))
    .where(and(...responseConditions))

  // 3. Fetch Test Grades for Batch Rank & Percentile (same batch, same school)
  const batchConditions = [eq(students.batch, student.batch)]
  if (schoolId) batchConditions.push(eq(students.schoolId, schoolId))
  if (range) {
    batchConditions.push(gte(tests.date, range.fromDate))
    batchConditions.push(lte(tests.date, range.toDate))
  }
  const allGrades = await db
    .select({
      studentId: testGrades.studentId,
      testId: testGrades.testId,
      marksObtained: testGrades.marksObtained,
      batch: students.batch,
    })
    .from(testGrades)
    .innerJoin(students, eq(students.id, testGrades.studentId))
    .innerJoin(tests, eq(tests.id, testGrades.testId))
    .where(and(...batchConditions))

  const studentTotalMarks = allGrades
    .filter((g) => g.studentId === studentId)
    .reduce((sum, g) => sum + (g.marksObtained || 0), 0)

  const totalsByStudent = new Map<string, number>()
  for (const g of allGrades) {
    totalsByStudent.set(g.studentId, (totalsByStudent.get(g.studentId) || 0) + (g.marksObtained || 0))
  }

  const sortedTotals = Array.from(totalsByStudent.values()).sort((a, b) => b - a)
  const totalStudentsInBatch = sortedTotals.length || 1
  const rankIndex = sortedTotals.findIndex((val) => val <= studentTotalMarks)
  const rank = rankIndex >= 0 ? rankIndex + 1 : totalStudentsInBatch
  const percentile = Math.max(0, Math.round(((totalStudentsInBatch - rank) / totalStudentsInBatch) * 100))
  const topPercent = Math.min(100, Math.max(1, Math.ceil((rank / totalStudentsInBatch) * 100)))

  // Subject, Chapter, Concept Breakdown
  const subjectStats = new Map<string, { name: string; marksObtained: number; maxMarks: number; correct: number; total: number }>()
  const chapterStats = new Map<string, { title: string; subject: string; correct: number; total: number }>()
  const conceptStats = new Map<string, { title: string; chapter: string; subject: string; correct: number; total: number }>()

  let totalMarksAttempted = 0
  let totalMarksObtained = 0
  let questionsAttempted = 0
  let questionsCorrect = 0
  let questionsIncorrect = 0
  let questionsUnattempted = 0

  const typeStats = new Map<string, { total: number; correct: number }>()
  const diffStats = new Map<string, { total: number; correct: number }>()
  const mistakeTypeCounts: Record<string, number> = {}

  for (const r of responses) {
    if (r.status === 'Correct') {
      questionsCorrect++
      questionsAttempted++
    } else if (r.status === 'Incorrect') {
      questionsIncorrect++
      questionsAttempted++
      const mt = r.mistakeType || 'Unclassified'
      mistakeTypeCounts[mt] = (mistakeTypeCounts[mt] || 0) + 1
    } else {
      questionsUnattempted++
    }

    totalMarksAttempted += r.marks
    totalMarksObtained += r.marksAwarded

    const qType = r.questionType || 'MCQ'
    if (!typeStats.has(qType)) typeStats.set(qType, { total: 0, correct: 0 })
    const tStat = typeStats.get(qType)!
    tStat.total++
    if (r.status === 'Correct') tStat.correct++

    const diff = r.difficulty || 'Medium'
    if (!diffStats.has(diff)) diffStats.set(diff, { total: 0, correct: 0 })
    const dStat = diffStats.get(diff)!
    dStat.total++
    if (r.status === 'Correct') dStat.correct++

    const subjName = r.subjectName || 'General'
    if (!subjectStats.has(subjName)) {
      subjectStats.set(subjName, { name: subjName, marksObtained: 0, maxMarks: 0, correct: 0, total: 0 })
    }
    const sStat = subjectStats.get(subjName)!
    sStat.maxMarks += r.marks
    sStat.marksObtained += r.marksAwarded
    sStat.total++
    if (r.status === 'Correct') sStat.correct++

    if (r.chapterName) {
      const cTitle = r.chapterName
      if (!chapterStats.has(cTitle)) {
        chapterStats.set(cTitle, { title: cTitle, subject: subjName, correct: 0, total: 0 })
      }
      const cStat = chapterStats.get(cTitle)!
      cStat.total++
      if (r.status === 'Correct') cStat.correct++
    }

    if (r.conceptName) {
      const conTitle = r.conceptName
      if (!conceptStats.has(conTitle)) {
        conceptStats.set(conTitle, { title: conTitle, chapter: r.chapterName || 'General', subject: subjName, correct: 0, total: 0 })
      }
      const conStat = conceptStats.get(conTitle)!
      conStat.total++
      if (r.status === 'Correct') conStat.correct++
    }
  }

  const accuracyRate = questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0
  const attemptRate = responses.length > 0 ? Math.round((questionsAttempted / responses.length) * 100) : 0
  const overallPercentage = totalMarksAttempted > 0 ? Math.max(0, Math.round((totalMarksObtained / totalMarksAttempted) * 100)) : 0

  let overallGrade = 'F'
  if (overallPercentage >= 90) overallGrade = 'A+'
  else if (overallPercentage >= 80) overallGrade = 'A'
  else if (overallPercentage >= 70) overallGrade = 'B'
  else if (overallPercentage >= 60) overallGrade = 'C'
  else if (overallPercentage >= 50) overallGrade = 'D'

  const topicMasteryList: TopicMasteryEntry[] = []

  chapterStats.forEach((cs) => {
    const mastery = cs.total > 0 ? Math.round((cs.correct / cs.total) * 100) : 0
    topicMasteryList.push({ topic: cs.title, mastery, category: 'Chapter', parent: cs.subject })
  })

  conceptStats.forEach((cs) => {
    const mastery = cs.total > 0 ? Math.round((cs.correct / cs.total) * 100) : 0
    topicMasteryList.push({ topic: cs.title, mastery, category: 'Concept', parent: cs.chapter })
  })

  const strongTopics = topicMasteryList.filter((t) => t.mastery >= 75)
  const averageTopics = topicMasteryList.filter((t) => t.mastery >= 50 && t.mastery < 75)
  const weakTopics = topicMasteryList.filter((t) => t.mastery < 50)

  // 4. Fetch Teacher Feedback (Daily Ratings & PTM)
  const dailyRatingsRows = await db
    .select()
    .from(dailyStudentRatings)
    .where(eq(dailyStudentRatings.studentId, studentId))

  const ptmRows = await db
    .select()
    .from(ptmReports)
    .where(eq(ptmReports.studentId, studentId))
    .orderBy(sql`${ptmReports.date} DESC`)

  const ratingToScore: Record<string, number> = {
    Unsatisfactory: 1,
    Satisfactory: 2,
    Good: 3,
    'Very Good': 4,
    Excellent: 5,
  }

  let attitudeSum = 0
  let behaviourSum = 0
  let focusSum = 0
  let interactionSum = 0

  for (const r of dailyRatingsRows) {
    attitudeSum += ratingToScore[r.attitude] || 3
    behaviourSum += ratingToScore[r.behaviour] || 3
    focusSum += ratingToScore[r.focus] || 3
    interactionSum += ratingToScore[r.interaction] || 3
  }

  const ratingCount = dailyRatingsRows.length || 1
  const attitudeAvg = Number((attitudeSum / ratingCount).toFixed(1))
  const behaviourAvg = Number((behaviourSum / ratingCount).toFixed(1))
  const focusAvg = Number((focusSum / ratingCount).toFixed(1))
  const interactionAvg = Number((interactionSum / ratingCount).toFixed(1))

  const behavioralScore = Number(
    ((attitudeAvg + behaviourAvg + focusAvg + interactionAvg) / 4).toFixed(1)
  )

  const ptmAttendedCount = ptmRows.filter((p) => p.parentAttended).length
  const ptmAttendanceRate = ptmRows.length > 0 ? Math.round((ptmAttendedCount / ptmRows.length) * 100) : 0

  // 5. Attendance % over range (or all-time when no range given)
  const attendanceConditions = [eq(attendanceEntries.studentId, studentId)]
  if (range) {
    attendanceConditions.push(gte(attendanceSessions.date, range.fromDate))
    attendanceConditions.push(lte(attendanceSessions.date, range.toDate))
  }
  if (schoolId) attendanceConditions.push(eq(attendanceSessions.schoolId, schoolId))
  const attendanceRows = await db
    .select({ status: attendanceEntries.status })
    .from(attendanceEntries)
    .innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceEntries.sessionId))
    .where(and(...attendanceConditions))

  const presentCount = attendanceRows.filter((r) => r.status === 'Present').length
  const totalSessions = attendanceRows.length
  const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // 6. Syllabus chapter coverage per subject, scoped to the student's batch
  let chapterCoverageBySubject = new Map<string, { total: number; completed: number }>()
  if (student.batchId) {
    const syllabusRows = await db
      .select({
        subjectName: subjects.name,
        status: batchSyllabus.status,
      })
      .from(batchSyllabus)
      .innerJoin(chapters, eq(chapters.id, batchSyllabus.chapterId))
      .innerJoin(subjects, eq(subjects.id, chapters.subjectId))
      .where(eq(batchSyllabus.batchId, student.batchId))

    for (const row of syllabusRows) {
      const bucket = chapterCoverageBySubject.get(row.subjectName) ?? { total: 0, completed: 0 }
      bucket.total++
      if (row.status === 'Completed') bucket.completed++
      chapterCoverageBySubject.set(row.subjectName, bucket)
    }
  }

  // 7. Concept mastery counts per subject, reusing the >=75 "mastered" threshold
  const conceptCoverageBySubject = new Map<string, { total: number; mastered: number }>()
  conceptStats.forEach((cs) => {
    const bucket = conceptCoverageBySubject.get(cs.subject) ?? { total: 0, mastered: 0 }
    bucket.total++
    const mastery = cs.total > 0 ? Math.round((cs.correct / cs.total) * 100) : 0
    if (mastery >= 75) bucket.mastered++
    conceptCoverageBySubject.set(cs.subject, bucket)
  })

  const allCoverageSubjects = new Set<string>([
    ...chapterCoverageBySubject.keys(),
    ...conceptCoverageBySubject.keys(),
  ])
  const subjectCoverage: SubjectCoverageEntry[] = Array.from(allCoverageSubjects).map((subject) => {
    const chapterInfo = chapterCoverageBySubject.get(subject)
    const conceptInfo = conceptCoverageBySubject.get(subject)
    return {
      subject,
      totalChaptersTaught: chapterInfo?.total ?? 0,
      completedChaptersCount: chapterInfo?.completed ?? 0,
      conceptsTotalCount: conceptInfo?.total ?? 0,
      conceptsMasteredCount: conceptInfo?.mastered ?? 0,
    }
  })

  return {
    student: {
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      batch: student.batch,
      programName: student.program || 'Standard',
      guardianName: student.parentContact || 'N/A',
      guardianPhone: student.phone || student.parentContact || 'N/A',
    },
    performanceReport: {
      overallPercentage,
      overallGrade,
      totalMarksObtained,
      totalMarksAttempted,
      rank,
      totalStudentsInBatch,
      percentile,
      topPercent,
      subjectBreakdown: Array.from(subjectStats.values()).map((s) => ({
        subject: s.name,
        marksObtained: s.marksObtained,
        maxMarks: s.maxMarks,
        percentage: s.maxMarks > 0 ? Math.round((s.marksObtained / s.maxMarks) * 100) : 0,
      })),
      chapterBreakdown: Array.from(chapterStats.values()).map((c) => ({
        chapter: c.title,
        subject: c.subject,
        correct: c.correct,
        total: c.total,
        accuracy: c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0,
      })),
    },
    testAnalysisReport: {
      totalQuestions: responses.length,
      questionsAttempted,
      questionsCorrect,
      questionsIncorrect,
      questionsUnattempted,
      accuracyRate,
      attemptRate,
      questionTypeBreakdown: Array.from(typeStats.entries()).map(([type, stat]) => ({
        type,
        total: stat.total,
        correct: stat.correct,
        accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      })),
      difficultyBreakdown: Array.from(diffStats.entries()).map(([difficulty, stat]) => ({
        difficulty,
        total: stat.total,
        correct: stat.correct,
        accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      })),
    },
    strengthVsWeaknessMap: {
      strongTopics,
      averageTopics,
      weakTopics,
    },
    attendance: {
      percentage: attendancePercentage,
      presentCount,
      totalSessions,
    },
    subjectCoverage,
    errorLogs: {
      mistakeTypeSummary: mistakeTypeCounts,
      recentErrors: responses
        .filter((r) => r.status === 'Incorrect')
        .slice(0, 10)
        .map((r) => ({
          id: r.responseId,
          testTitle: r.testTitle,
          questionText: r.questionText,
          chapterTitle: r.chapterName || 'General',
          mistakeType: r.mistakeType || 'Unclassified',
          date: r.testDate,
        })),
    },
    teacherFeedbackSummary: {
      dailyRatingsCount: dailyRatingsRows.length,
      ratings: {
        attitude: attitudeAvg,
        behaviour: behaviourAvg,
        focus: focusAvg,
        interaction: interactionAvg,
        behavioralScore,
      },
      ptm: {
        totalMeetings: ptmRows.length,
        attendanceRate: ptmAttendanceRate,
        recentLogs: ptmRows.slice(0, 5).map((p) => ({
          id: p.id,
          date: p.date,
          parentName: p.parentName,
          parentAttended: p.parentAttended,
          discussionNotes: p.discussionNotes,
          actionItems: p.actionItems,
          followUpDate: p.followUpDate,
        })),
      },
    },
  }
}
