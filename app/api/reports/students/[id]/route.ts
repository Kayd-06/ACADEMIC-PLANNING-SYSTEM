import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
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
} from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await params

    // 1. Fetch Student Details
    const [student] = await db.select().from(students).where(eq(students.id, studentId))
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // 2. Fetch All Test Responses for the Student
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
      .where(eq(testQuestionResponses.studentId, studentId))

    // 3. Fetch Test Grades for Overall Performance & Rank calculation
    const allGrades = await db
      .select({
        studentId: testGrades.studentId,
        testId: testGrades.testId,
        marksObtained: testGrades.marksObtained,
        batch: students.batch,
      })
      .from(testGrades)
      .innerJoin(students, eq(students.id, testGrades.studentId))
      .where(eq(students.batch, student.batch))

    // Batch rank & percentile
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

    // Calculate Subject, Chapter, and Concept Breakdown
    const subjectStats = new Map<string, { name: string; marksObtained: number; maxMarks: number; correct: number; total: number }>()
    const chapterStats = new Map<string, { title: string; subject: string; correct: number; total: number }>()
    const conceptStats = new Map<string, { title: string; chapter: string; correct: number; total: number }>()

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
        const mType = r.mistakeType || 'Unclassified'
        mistakeTypeCounts[mType] = (mistakeTypeCounts[mType] || 0) + 1
      } else {
        questionsUnattempted++
      }

      totalMarksAttempted += r.marks
      totalMarksObtained += r.marksAwarded

      // Type stats
      const qType = r.questionType || 'MCQ'
      if (!typeStats.has(qType)) typeStats.set(qType, { total: 0, correct: 0 })
      const tStat = typeStats.get(qType)!
      tStat.total++
      if (r.status === 'Correct') tStat.correct++

      // Difficulty stats
      const diff = r.difficulty || 'Medium'
      if (!diffStats.has(diff)) diffStats.set(diff, { total: 0, correct: 0 })
      const dStat = diffStats.get(diff)!
      dStat.total++
      if (r.status === 'Correct') dStat.correct++

      // Subject stats
      const subjName = r.subjectName || 'General'
      if (!subjectStats.has(subjName)) {
        subjectStats.set(subjName, { name: subjName, marksObtained: 0, maxMarks: 0, correct: 0, total: 0 })
      }
      const sStat = subjectStats.get(subjName)!
      sStat.maxMarks += r.marks
      sStat.marksObtained += r.marksAwarded
      sStat.total++
      if (r.status === 'Correct') sStat.correct++

      // Chapter stats
      if (r.chapterName) {
        const cTitle = r.chapterName
        if (!chapterStats.has(cTitle)) {
          chapterStats.set(cTitle, { title: cTitle, subject: subjName, correct: 0, total: 0 })
        }
        const cStat = chapterStats.get(cTitle)!
        cStat.total++
        if (r.status === 'Correct') cStat.correct++
      }

      // Concept stats
      if (r.conceptName) {
        const conTitle = r.conceptName
        if (!conceptStats.has(conTitle)) {
          conceptStats.set(conTitle, { title: conTitle, chapter: r.chapterName || 'General', correct: 0, total: 0 })
        }
        const conStat = conceptStats.get(conTitle)!
        conStat.total++
        if (r.status === 'Correct') conStat.correct++
      }
    }

    const accuracyRate = questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0
    const attemptRate = responses.length > 0 ? Math.round((questionsAttempted / responses.length) * 100) : 0
    const overallPercentage = totalMarksAttempted > 0 ? Math.max(0, Math.round((totalMarksObtained / totalMarksAttempted) * 100)) : 0

    // Grade calculation
    let overallGrade = 'F'
    if (overallPercentage >= 90) overallGrade = 'A+'
    else if (overallPercentage >= 80) overallGrade = 'A'
    else if (overallPercentage >= 70) overallGrade = 'B'
    else if (overallPercentage >= 60) overallGrade = 'C'
    else if (overallPercentage >= 50) overallGrade = 'D'

    // Formulate Strength vs Weakness Topics
    const topicMasteryList: { topic: string; mastery: number; category: 'Chapter' | 'Concept'; parent: string }[] = []

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

    // Construct Response Object for all 5 Reports
    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        batch: student.batch,
        programName: student.program || 'Standard',
        guardianName: 'Parent/Guardian',
        guardianPhone: student.phone || 'N/A',
      },
      performanceReport: {
        overallPercentage,
        overallGrade,
        totalMarksObtained,
        totalMarksAttempted,
        rank,
        totalStudentsInBatch,
        percentile,
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
    })
  } catch (err) {
    console.error('[Student Full Reports GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
