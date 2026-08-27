# Report Generation Engine (Push 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing live student-analytics computation into a shared, date-range-aware module, extend it with attendance % and syllabus coverage, and build the `generateStudentReport`/`generateBatchReports` engine (with upsert semantics) behind a new `POST /api/reports/generate` route — with no UI or PDF changes in this push.

**Architecture:** Extract `app/api/reports/students/[id]/route.ts`'s inline computation into `lib/reports/student-analytics.ts` as a pure function (behavior-preserving refactor, verified by the existing test suite), add a `range` parameter plus attendance/coverage data to it, then layer a generate engine (`lib/reports/generate-report.ts`) on top that maps the analytics result onto `generated_student_reports` / `report_subject_analytics` rows via two new query functions, and expose it through one new API route.

**Tech Stack:** Next.js App Router route handlers, Drizzle ORM over Neon Postgres (`drizzle-orm/neon-http` — no transactions), Jest against the real Neon dev DB.

**Spec:** `docs/superpowers/specs/2026-08-27-report-generation-pdf-design.md`

## Global Constraints

- No `db.transaction(...)` anywhere — the `neon-http` driver does not support it. Multi-step writes are sequential statements.
- Every query touching `students`/`generatedStudentReports`/etc. must scope by `schoolId` where the table has one.
- `range.fromDate`/`range.toDate` are inclusive `YYYY-MM-DD` strings, compared with `gte`/`lte` (lexicographic string comparison — same pattern as `attendance/overview/route.ts`).
- `strengthAreas`/`improvementAreas`/`teacherRemarks`/`principalRemarks` on `generated_student_reports` are never written by the generate engine, only by the existing manual PATCH endpoint.
- Existing `app/api/reports/students/[id]/route.test.ts` must keep passing unmodified through every task in this plan.
- This plan covers Push 1 only (engine + API, no PDF/UI/schema-branding changes) per the spec's two-push sequencing.

---

### Task 1: Extract `computeStudentAnalytics` (behavior-preserving refactor)

**Files:**
- Create: `lib/reports/student-analytics.ts`
- Modify: `app/api/reports/students/[id]/route.ts`
- Test: `app/api/reports/students/[id]/route.test.ts` (existing — must pass unmodified, no edits to this file in this task)

**Interfaces:**
- Consumes: nothing new — this is a straight lift of the existing inline logic.
- Produces: `computeStudentAnalytics(studentId: string, schoolId: string | null): Promise<StudentAnalyticsResult | null>` and the `StudentAnalyticsResult` type (plus `SubjectBreakdownEntry`, `ChapterBreakdownEntry`, `TopicMasteryEntry`), all exported from `lib/reports/student-analytics.ts`. Task 2 adds a `range` parameter and new fields to this same function and type — later tasks only ever import `computeStudentAnalytics` and `StudentAnalyticsResult` from this path.

- [ ] **Step 1: Run the existing test suite to confirm the baseline passes**

Run: `npx jest app/api/reports/students/[id]/route.test.ts`
Expected: PASS (3 tests) — this is the safety net for the refactor in the next step.

- [ ] **Step 2: Create `lib/reports/student-analytics.ts` with the extracted computation**

```ts
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
import { eq, and, sql } from 'drizzle-orm'

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
): Promise<StudentAnalyticsResult | null> {
  // 1. Fetch Student Details, scoped to the caller's school
  const studentConditions = [eq(students.id, studentId)]
  if (schoolId) studentConditions.push(eq(students.schoolId, schoolId))
  const [student] = await db.select().from(students).where(and(...studentConditions))
  if (!student) return null

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

  // 3. Fetch Test Grades for Batch Rank & Percentile (same batch, same school)
  const batchConditions = [eq(students.batch, student.batch)]
  if (schoolId) batchConditions.push(eq(students.schoolId, schoolId))
  const allGrades = await db
    .select({
      studentId: testGrades.studentId,
      testId: testGrades.testId,
      marksObtained: testGrades.marksObtained,
      batch: students.batch,
    })
    .from(testGrades)
    .innerJoin(students, eq(students.id, testGrades.studentId))
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
```

- [ ] **Step 3: Replace the route body with a thin wrapper**

Replace the full contents of `app/api/reports/students/[id]/route.ts` with:

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { computeStudentAnalytics } from '@/lib/reports/student-analytics'

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
    const schoolId = (session.user as any).schoolId as string | null

    const result = await computeStudentAnalytics(studentId, schoolId)
    if (!result) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Student Full Reports GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the existing test suite again to confirm the refactor changed nothing observable**

Run: `npx jest app/api/reports/students/[id]/route.test.ts`
Expected: PASS (same 3 tests, unmodified assertions)

- [ ] **Step 5: Commit**

```bash
git add lib/reports/student-analytics.ts app/api/reports/students/[id]/route.ts
git commit -m "refactor: extract computeStudentAnalytics into shared lib/reports module"
```

---

### Task 2: Add date-range filtering, attendance %, and subject coverage

**Files:**
- Modify: `lib/reports/student-analytics.ts`
- Test: `lib/reports/student-analytics.test.ts` (new)

**Interfaces:**
- Consumes: `computeStudentAnalytics`, `StudentAnalyticsResult` from Task 1 (same file).
- Produces: `StudentAnalyticsRange` type (`{ fromDate: string; toDate: string }`), `computeStudentAnalytics(studentId, schoolId, range?: StudentAnalyticsRange)` (range now the third optional param), `StudentAnalyticsResult` gains `attendance: { percentage: number; presentCount: number; totalSessions: number }` and `subjectCoverage: SubjectCoverageEntry[]`. `SubjectCoverageEntry = { subject: string; totalChaptersTaught: number; completedChaptersCount: number; conceptsTotalCount: number; conceptsMasteredCount: number }`. Task 4's generate engine consumes exactly these two new fields plus the existing `performanceReport`/`subjectBreakdown` fields.

- [ ] **Step 1: Write the failing tests**

Create `lib/reports/student-analytics.test.ts`:

```ts
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

  it('computes per-subject chapter coverage from batchSyllabus for the student\'s batchId', async () => {
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/reports/student-analytics.test.ts`
Expected: FAIL — `computeStudentAnalytics` does not accept a third argument, and `result.attendance`/`result.subjectCoverage` are `undefined`.

- [ ] **Step 3: Implement the range/attendance/coverage additions**

In `lib/reports/student-analytics.ts`:

Add to the imports:

```ts
import {
  students,
  testGrades,
  tests,
  testQuestionResponses,
  questions,
  chapters,
  concepts,
  subjects,
  batchSyllabus,
  attendanceSessions,
  attendanceEntries,
  dailyStudentRatings,
  ptmReports,
} from '@/lib/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
```

Add the new range/coverage types alongside the existing ones:

```ts
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
```

Add `attendance` and `subjectCoverage` to `StudentAnalyticsResult`:

```ts
export interface StudentAnalyticsResult {
  // ...unchanged fields above...
  attendance: {
    percentage: number
    presentCount: number
    totalSessions: number
  }
  subjectCoverage: SubjectCoverageEntry[]
  // ...unchanged teacherFeedbackSummary field stays last...
}
```

Change the function signature:

```ts
export async function computeStudentAnalytics(
  studentId: string,
  schoolId: string | null,
  range?: StudentAnalyticsRange,
): Promise<StudentAnalyticsResult | null> {
```

Replace the `responses` query's `.where(...)` clause:

```ts
  const responseConditions = [eq(testQuestionResponses.studentId, studentId)]
  if (range) {
    responseConditions.push(gte(tests.date, range.fromDate))
    responseConditions.push(lte(tests.date, range.toDate))
  }
  const responses = await db
    .select({
      // ...unchanged column list...
    })
    .from(testQuestionResponses)
    .innerJoin(tests, eq(tests.id, testQuestionResponses.testId))
    .innerJoin(questions, eq(questions.id, testQuestionResponses.questionId))
    .leftJoin(chapters, eq(chapters.id, questions.chapterId))
    .leftJoin(concepts, eq(concepts.id, questions.conceptId))
    .where(and(...responseConditions))
```

Replace the `allGrades` query to join `tests` and apply the same range filter:

```ts
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
```

Add `subject` to the `conceptStats` map value and its two write sites:

```ts
  const conceptStats = new Map<string, { title: string; chapter: string; subject: string; correct: number; total: number }>()
```

```ts
    if (r.conceptName) {
      const conTitle = r.conceptName
      if (!conceptStats.has(conTitle)) {
        conceptStats.set(conTitle, { title: conTitle, chapter: r.chapterName || 'General', subject: subjName, correct: 0, total: 0 })
      }
      const conStat = conceptStats.get(conTitle)!
      conStat.total++
      if (r.status === 'Correct') conStat.correct++
    }
```

After the existing `ptmAttendanceRate` computation and before the `return`, add attendance, syllabus coverage, and the combined subject-coverage computation:

```ts
  // 5. Attendance % over the range (or all-time when no range given)
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
```

Add `attendance` and `subjectCoverage` to the returned object (right after `strengthVsWeaknessMap`, before `errorLogs`):

```ts
    attendance: {
      percentage: attendancePercentage,
      presentCount,
      totalSessions,
    },
    subjectCoverage,
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx jest lib/reports/student-analytics.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the existing live-Hub test suite to confirm the no-range path is unchanged**

Run: `npx jest app/api/reports/students/[id]/route.test.ts`
Expected: PASS (same 3 tests, unmodified assertions — the route never passes a `range`, so its output is untouched)

- [ ] **Step 6: Commit**

```bash
git add lib/reports/student-analytics.ts lib/reports/student-analytics.test.ts
git commit -m "feat: add date-range filtering, attendance %, and subject coverage to computeStudentAnalytics"
```

---

### Task 3: Add `getReportByStudentTerm` and `replaceReportSubjectAnalytics` query functions

**Files:**
- Modify: `lib/db/queries/generated-reports.ts`
- Test: `lib/db/queries/generated-reports.test.ts` (new)

**Interfaces:**
- Consumes: existing `generatedStudentReports`, `reportSubjectAnalytics` schema tables and the existing `SubjectAnalyticsPayload` type from this same file.
- Produces: `getReportByStudentTerm(studentId: string, academicYear: string, term: string, schoolId?: string | null): Promise<GeneratedStudentReport | null>` and `replaceReportSubjectAnalytics(reportId: string, subjects: SubjectAnalyticsPayload[]): Promise<ReportSubjectAnalytics[]>`. Task 4's generate engine calls both of these by name.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/generated-reports.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, generatedStudentReports, reportSubjectAnalytics } from '@/lib/db/schema'
import {
  getReportByStudentTerm,
  replaceReportSubjectAnalytics,
  createGeneratedReport,
} from './generated-reports'

describe('generated-reports queries: getReportByStudentTerm / replaceReportSubjectAnalytics', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
  })

  it('returns null when no report exists for the (studentId, academicYear, term) triple', async () => {
    const [school] = await db.insert(schools).values({ name: 'Lookup School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Lookup Student', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const found = await getReportByStudentTerm(student.id, '2026-27', 'Term 1', school.id)
    expect(found).toBeNull()
  })

  it('finds an existing report by (studentId, academicYear, term), scoped by schoolId', async () => {
    const [school] = await db.insert(schools).values({ name: 'Lookup School 2' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Lookup Student 2', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const created = await createGeneratedReport({
      schoolId: school.id, studentId: student.id, reportTitle: 'Term 1 Report',
      academicYear: '2026-27', term: 'Term 1',
    })
    createdIds.reports.push(created.id)

    const found = await getReportByStudentTerm(student.id, '2026-27', 'Term 1', school.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('replaces subject analytics rows, dropping subjects no longer present', async () => {
    const [school] = await db.insert(schools).values({ name: 'Replace School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Replace Student', schoolId: school.id, batch: 'X' }).returning()
    createdIds.students.push(student.id)

    const created = await createGeneratedReport({
      schoolId: school.id, studentId: student.id, reportTitle: 'Replace Report',
      academicYear: '2026-27', term: 'Term 1',
      subjects: [
        { subjectName: 'Physics', marksObtained: 40, maxMarks: 100, grade: 'D' },
        { subjectName: 'Chemistry', marksObtained: 50, maxMarks: 100, grade: 'C' },
      ],
    })
    createdIds.reports.push(created.id)

    const replaced = await replaceReportSubjectAnalytics(created.id, [
      { subjectName: 'Physics', marksObtained: 90, maxMarks: 100, grade: 'A' },
    ])

    expect(replaced).toHaveLength(1)
    expect(replaced[0].subjectName).toBe('Physics')
    expect(replaced[0].marksObtained).toBe(90)

    const remaining = await db.select().from(reportSubjectAnalytics).where(eq(reportSubjectAnalytics.reportId, created.id))
    expect(remaining).toHaveLength(1)
    expect(remaining[0].subjectName).toBe('Physics')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/db/queries/generated-reports.test.ts`
Expected: FAIL — `getReportByStudentTerm` and `replaceReportSubjectAnalytics` are not exported.

- [ ] **Step 3: Implement the two functions**

Append to `lib/db/queries/generated-reports.ts` (after `upsertReportSubjectAnalytics`, before `deleteGeneratedReport`):

```ts
export async function getReportByStudentTerm(
  studentId: string,
  academicYear: string,
  term: string,
  schoolId?: string | null,
): Promise<GeneratedStudentReport | null> {
  const conditions = [
    eq(generatedStudentReports.studentId, studentId),
    eq(generatedStudentReports.academicYear, academicYear),
    eq(generatedStudentReports.term, term),
  ]
  if (schoolId) conditions.push(eq(generatedStudentReports.schoolId, schoolId))

  const [report] = await db
    .select()
    .from(generatedStudentReports)
    .where(and(...conditions))

  return report ?? null
}

export async function replaceReportSubjectAnalytics(
  reportId: string,
  subjects: SubjectAnalyticsPayload[],
): Promise<ReportSubjectAnalytics[]> {
  await db.delete(reportSubjectAnalytics).where(eq(reportSubjectAnalytics.reportId, reportId))

  if (subjects.length === 0) return []

  return db
    .insert(reportSubjectAnalytics)
    .values(subjects.map((s) => ({
      reportId,
      subjectName:            s.subjectName,
      marksObtained:          s.marksObtained,
      maxMarks:               s.maxMarks,
      grade:                  s.grade,
      totalChaptersTaught:    s.totalChaptersTaught    ?? 0,
      completedChaptersCount: s.completedChaptersCount ?? 0,
      conceptsMasteredCount:  s.conceptsMasteredCount  ?? 0,
      conceptsTotalCount:     s.conceptsTotalCount     ?? 0,
      subjectTeacherRemarks:  s.subjectTeacherRemarks  ?? '',
    })))
    .returning()
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/db/queries/generated-reports.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/generated-reports.ts lib/db/queries/generated-reports.test.ts
git commit -m "feat: add getReportByStudentTerm and replaceReportSubjectAnalytics query functions"
```

---

### Task 4: Generate engine — `generateStudentReport` and `generateBatchReports`

**Files:**
- Create: `lib/reports/generate-report.ts`
- Test: `lib/reports/generate-report.test.ts`

**Interfaces:**
- Consumes: `computeStudentAnalytics` + `StudentAnalyticsResult` (Task 2), `getReportByStudentTerm` + `replaceReportSubjectAnalytics` + `updateGeneratedReport` + `createGeneratedReport` + `CreateReportPayload` (Task 3 / existing), `students` schema table.
- Produces: `generateStudentReport(params: GenerateStudentReportParams): Promise<GenerateStudentReportResult>` and `generateBatchReports(params: GenerateBatchReportsParams): Promise<GenerateBatchReportsResult>`. Task 5's API route consumes exactly these two functions and their param/result types.

- [ ] **Step 1: Write the failing tests**

Create `lib/reports/generate-report.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  schools,
  students,
  batches,
  tests,
  questions,
  testQuestionResponses,
  generatedStudentReports,
  reportSubjectAnalytics,
} from '@/lib/db/schema'
import { generateStudentReport, generateBatchReports } from './generate-report'
import { updateGeneratedReport } from '@/lib/db/queries/generated-reports'

describe('generateStudentReport / generateBatchReports', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    batches: [] as string[],
    tests: [] as string[],
    questions: [] as string[],
    responses: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.responses) await db.delete(testQuestionResponses).where(eq(testQuestionResponses.id, id))
    for (const id of createdIds.questions) await db.delete(questions).where(eq(questions.id, id))
    for (const id of createdIds.tests) await db.delete(tests).where(eq(tests.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
  })

  it('inserts a new DRAFT report on first generation for a student', async () => {
    const [school] = await db.insert(schools).values({ name: 'Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Gen Student', schoolId: school.id, batch: 'G1' }).returning()
    createdIds.students.push(student.id)

    const { report, outcome } = await generateStudentReport({
      studentId: student.id,
      schoolId: school.id,
      batchId: null,
      academicYear: '2026-27',
      term: 'Term 1',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
      generatedBy: null,
    })
    createdIds.reports.push(report.id)

    expect(outcome).toBe('generated')
    expect(report.status).toBe('DRAFT')
    expect(report.studentId).toBe(student.id)
  })

  it('overwrites computed fields in place on a second call while a report is DRAFT, without touching remarks', async () => {
    const [school] = await db.insert(schools).values({ name: 'Overwrite School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Overwrite Student', schoolId: school.id, batch: 'G2' }).returning()
    createdIds.students.push(student.id)

    const first = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })
    createdIds.reports.push(first.report.id)

    await updateGeneratedReport(first.report.id, { teacherRemarks: 'Hand-written remark' }, school.id)

    const second = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(second.outcome).toBe('generated')
    expect(second.report.id).toBe(first.report.id)
    expect(second.report.teacherRemarks).toBe('Hand-written remark')
  })

  it('skips generation for a PUBLISHED report', async () => {
    const [school] = await db.insert(schools).values({ name: 'Published School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Published Student', schoolId: school.id, batch: 'G3' }).returning()
    createdIds.students.push(student.id)

    const first = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })
    createdIds.reports.push(first.report.id)
    await updateGeneratedReport(first.report.id, { status: 'PUBLISHED' }, school.id)

    const second = await generateStudentReport({
      studentId: student.id, schoolId: school.id, batchId: null,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(second.outcome).toBe('skipped')
    expect(second.reason).toBe('already PUBLISHED')
  })

  it('generateBatchReports runs generateStudentReport for every active student in the batch', async () => {
    const [school] = await db.insert(schools).values({ name: 'Batch Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({ name: `BATCHGEN-${Date.now()}`, schoolId: school.id }).returning()
    createdIds.batches.push(batch.id)

    const [activeStudent] = await db.insert(students).values({
      name: 'Active Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: true,
    }).returning()
    const [inactiveStudent] = await db.insert(students).values({
      name: 'Inactive Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: false,
    }).returning()
    createdIds.students.push(activeStudent.id, inactiveStudent.id)

    const { results } = await generateBatchReports({
      batchId: batch.id, schoolId: school.id,
      academicYear: '2026-27', term: 'Term 1',
      fromDate: '2026-06-01', toDate: '2026-06-30', generatedBy: null,
    })

    expect(results).toHaveLength(1)
    expect(results[0].studentId).toBe(activeStudent.id)
    expect(results[0].outcome).toBe('generated')

    const rows = await db.select().from(generatedStudentReports).where(eq(generatedStudentReports.batchId, batch.id))
    createdIds.reports.push(...rows.map((r) => r.id))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/reports/generate-report.test.ts`
Expected: FAIL — `./generate-report` module does not exist.

- [ ] **Step 3: Implement `lib/reports/generate-report.ts`**

```ts
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { students, type GeneratedStudentReport } from '@/lib/db/schema'
import { computeStudentAnalytics } from '@/lib/reports/student-analytics'
import {
  createGeneratedReport,
  updateGeneratedReport,
  getReportByStudentTerm,
  replaceReportSubjectAnalytics,
  type SubjectAnalyticsPayload,
} from '@/lib/db/queries/generated-reports'

export interface GenerateStudentReportParams {
  studentId: string
  schoolId: string
  batchId: string | null
  academicYear: string
  term: string
  fromDate: string
  toDate: string
  generatedBy: string | null
}

export interface GenerateStudentReportResult {
  report: GeneratedStudentReport
  outcome: 'generated' | 'skipped'
  reason?: string
}

const LOCKED_STATUSES = ['PUBLISHED', 'SENT_TO_PARENT']

export async function generateStudentReport(
  params: GenerateStudentReportParams,
): Promise<GenerateStudentReportResult> {
  const { studentId, schoolId, batchId, academicYear, term, fromDate, toDate, generatedBy } = params

  const analytics = await computeStudentAnalytics(studentId, schoolId, { fromDate, toDate })
  if (!analytics) {
    throw new Error(`Student ${studentId} not found for school ${schoolId}`)
  }

  const subjectPayloads: SubjectAnalyticsPayload[] = analytics.performanceReport.subjectBreakdown.map((s) => {
    const coverage = analytics.subjectCoverage.find((c) => c.subject === s.subject)
    let grade = 'F'
    if (s.percentage >= 90) grade = 'A+'
    else if (s.percentage >= 80) grade = 'A'
    else if (s.percentage >= 70) grade = 'B'
    else if (s.percentage >= 60) grade = 'C'
    else if (s.percentage >= 50) grade = 'D'

    return {
      subjectName: s.subject,
      marksObtained: s.marksObtained,
      maxMarks: s.maxMarks,
      grade,
      totalChaptersTaught: coverage?.totalChaptersTaught ?? 0,
      completedChaptersCount: coverage?.completedChaptersCount ?? 0,
      conceptsMasteredCount: coverage?.conceptsMasteredCount ?? 0,
      conceptsTotalCount: coverage?.conceptsTotalCount ?? 0,
    }
  })

  const computedFields = {
    overallPercentage: `${analytics.performanceReport.overallPercentage}%`,
    overallGrade: analytics.performanceReport.overallGrade,
    classRank: String(analytics.performanceReport.rank),
    batchRank: `${analytics.performanceReport.rank}/${analytics.performanceReport.totalStudentsInBatch}`,
    attendancePercentage: analytics.attendance.percentage,
    syllabusCoveragePercentage: computeAverageCoverage(analytics.subjectCoverage),
  }

  const existing = await getReportByStudentTerm(studentId, academicYear, term, schoolId)

  if (existing && LOCKED_STATUSES.includes(existing.status)) {
    return { report: existing, outcome: 'skipped', reason: `already ${existing.status}` }
  }

  if (existing) {
    const updated = await updateGeneratedReport(existing.id, computedFields, schoolId)
    await replaceReportSubjectAnalytics(existing.id, subjectPayloads)
    return { report: updated!, outcome: 'generated' }
  }

  const created = await createGeneratedReport({
    schoolId,
    studentId,
    batchId,
    reportTitle: `${term} Report - ${academicYear}`,
    academicYear,
    term,
    generatedBy,
    subjects: subjectPayloads,
    ...computedFields,
  })
  return { report: created, outcome: 'generated' }
}

function computeAverageCoverage(subjectCoverage: { totalChaptersTaught: number; completedChaptersCount: number }[]): number {
  const totals = subjectCoverage.reduce(
    (acc, s) => ({ taught: acc.taught + s.totalChaptersTaught, completed: acc.completed + s.completedChaptersCount }),
    { taught: 0, completed: 0 },
  )
  return totals.taught > 0 ? Math.round((totals.completed / totals.taught) * 100) : 0
}

export interface GenerateBatchReportsParams {
  batchId: string
  schoolId: string
  academicYear: string
  term: string
  fromDate: string
  toDate: string
  generatedBy: string | null
}

export interface GenerateBatchReportsResult {
  results: Array<{
    studentId: string
    outcome: 'generated' | 'skipped' | 'failed'
    reason?: string
  }>
}

export async function generateBatchReports(
  params: GenerateBatchReportsParams,
): Promise<GenerateBatchReportsResult> {
  const { batchId, schoolId, academicYear, term, fromDate, toDate, generatedBy } = params

  const activeStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.batchId, batchId), eq(students.schoolId, schoolId), eq(students.isActive, true)))

  const results: GenerateBatchReportsResult['results'] = []

  for (const student of activeStudents) {
    try {
      const { outcome, reason } = await generateStudentReport({
        studentId: student.id, schoolId, batchId, academicYear, term, fromDate, toDate, generatedBy,
      })
      results.push({ studentId: student.id, outcome, reason })
    } catch (err: any) {
      results.push({ studentId: student.id, outcome: 'failed', reason: err.message ?? 'Unknown error' })
    }
  }

  return { results }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/reports/generate-report.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/reports/generate-report.ts lib/reports/generate-report.test.ts
git commit -m "feat: add generateStudentReport/generateBatchReports engine with upsert semantics"
```

---

### Task 5: `POST /api/reports/generate` route

**Files:**
- Create: `app/api/reports/generate/route.ts`
- Test: `app/api/reports/generate/route.test.ts`

**Interfaces:**
- Consumes: `generateStudentReport`, `generateBatchReports` and their param/result types from Task 4.
- Produces: the HTTP contract described in the spec — `POST` body `{ studentId?, batchId?, academicYear, term, fromDate, toDate }`, exactly one of `studentId`/`batchId` required. Nothing downstream in this plan consumes this route; it's the final task.

- [ ] **Step 1: Write the failing tests**

Create `app/api/reports/generate/route.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schools, students, batches, generatedStudentReports } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
import { auth } from '@/lib/auth'
import { POST } from './route'

function req(body: any) {
  return new Request('http://localhost/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/reports/generate', () => {
  const createdIds = {
    schools: [] as string[],
    students: [] as string[],
    batches: [] as string[],
    reports: [] as string[],
  }

  afterEach(async () => {
    for (const id of createdIds.reports) await db.delete(generatedStudentReports).where(eq(generatedStudentReports.id, id))
    for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
    for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
    for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
    Object.values(createdIds).forEach((arr) => (arr.length = 0))
    jest.clearAllMocks()
  })

  it('rejects no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await POST(req({ studentId: 'x', academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30' }))
    expect(res.status).toBe(401)
  })

  it('rejects when neither studentId nor batchId is provided', async () => {
    const [school] = await db.insert(schools).values({ name: 'Validation School' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({ academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30' }))
    expect(res.status).toBe(400)
  })

  it('rejects when both studentId and batchId are provided', async () => {
    const [school] = await db.insert(schools).values({ name: 'Validation School 2' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const res = await POST(req({
      studentId: 'x', batchId: 'y', academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(400)
  })

  it('generates a single student report and returns the outcome', async () => {
    const [school] = await db.insert(schools).values({ name: 'Single Gen School' }).returning()
    createdIds.schools.push(school.id)
    const [student] = await db.insert(students).values({ name: 'Single Gen Student', schoolId: school.id, batch: 'S1' }).returning()
    createdIds.students.push(student.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'management', schoolId: school.id } })

    const res = await POST(req({
      studentId: student.id, academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outcome).toBe('generated')
    expect(body.report.studentId).toBe(student.id)
    createdIds.reports.push(body.report.id)
  })

  it('generates batch reports and returns a per-student summary', async () => {
    const [school] = await db.insert(schools).values({ name: 'Batch Gen Route School' }).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({ name: `ROUTEBATCH-${Date.now()}`, schoolId: school.id }).returning()
    createdIds.batches.push(batch.id)
    const [student] = await db.insert(students).values({
      name: 'Batch Route Student', schoolId: school.id, batch: batch.name, batchId: batch.id, isActive: true,
    }).returning()
    createdIds.students.push(student.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'management', schoolId: school.id } })

    const res = await POST(req({
      batchId: batch.id, academicYear: '2026-27', term: 'Term 1', fromDate: '2026-06-01', toDate: '2026-06-30',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].outcome).toBe('generated')

    const rows = await db.select().from(generatedStudentReports).where(eq(generatedStudentReports.batchId, batch.id))
    createdIds.reports.push(...rows.map((r: any) => r.id))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/api/reports/generate/route.test.ts`
Expected: FAIL — `./route` module does not exist.

- [ ] **Step 3: Implement `app/api/reports/generate/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateStudentReport, generateBatchReports } from '@/lib/reports/generate-report'

export const dynamic = 'force-dynamic'

interface GenerateRequestBody {
  studentId?: string
  batchId?: string
  academicYear: string
  term: string
  fromDate: string
  toDate: string
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

    const body = await req.json() as Partial<GenerateRequestBody>
    const { studentId, batchId, academicYear, term, fromDate, toDate } = body

    if (!academicYear || !term || !fromDate || !toDate) {
      return NextResponse.json({
        error: 'academicYear, term, fromDate, and toDate are required',
      }, { status: 400 })
    }

    if ((!studentId && !batchId) || (studentId && batchId)) {
      return NextResponse.json({
        error: 'Exactly one of studentId or batchId is required',
      }, { status: 400 })
    }

    const generatedBy = (session.user as any).id as string | undefined

    if (studentId) {
      const result = await generateStudentReport({
        studentId,
        schoolId,
        batchId: null,
        academicYear,
        term,
        fromDate,
        toDate,
        generatedBy: generatedBy ?? null,
      })
      return NextResponse.json(result)
    }

    const result = await generateBatchReports({
      batchId: batchId!,
      schoolId,
      academicYear,
      term,
      fromDate,
      toDate,
      generatedBy: generatedBy ?? null,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('reports/generate POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/api/reports/generate/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full report-related test suite one more time to confirm nothing regressed**

Run: `npx jest lib/reports app/api/reports`
Expected: PASS (all suites — Tasks 1 through 5's tests plus the untouched existing `generated`/`generated/[id]` route tests, if any exist)

- [ ] **Step 6: Commit**

```bash
git add app/api/reports/generate/route.ts app/api/reports/generate/route.test.ts
git commit -m "feat: add POST /api/reports/generate route for single-student and batch report generation"
```

---

## Self-Review

**Spec coverage:**
- Goal 1 (`generateStudentReport` with upsert semantics) → Task 4.
- Goal 2 (`generateBatchReports`, per-student outcome summary) → Task 4 + Task 5.
- Goal 5 (extract shared analytics into a date-range-aware function) → Tasks 1–2.
- Attendance % and syllabus coverage (spec Architecture §1) → Task 2.
- Upsert semantics exactly as specified (insert / overwrite-in-place-if-DRAFT / skip-if-locked, remarks never overwritten) → Task 4, verified by Task 4's three upsert-path tests.
- `POST /api/reports/generate` contract (§3) → Task 5.
- "Existing route's tests must keep passing unmodified" (Testing section) → verified at the end of Task 1, Task 2, and Task 5.
- Goals 3–4 (PDF, UI) and the schema addition (§4) are explicitly Push 2 — out of scope here, matching the spec's sequencing.

**Placeholder scan:** No TBD/TODO markers; every step has runnable code and an exact test command.

**Type consistency:** `StudentAnalyticsResult` (Task 1, extended in Task 2) → consumed by `generateStudentReport` (Task 4) via `analytics.performanceReport.subjectBreakdown`, `analytics.subjectCoverage`, `analytics.attendance` — field names match exactly. `SubjectAnalyticsPayload` (existing, Task 3) → same shape used in Task 4's `subjectPayloads`. `GenerateStudentReportResult`/`GenerateBatchReportsResult` (Task 4) → consumed as-is by the route in Task 5 with no renaming.
