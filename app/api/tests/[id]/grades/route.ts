import { NextRequest, NextResponse } from 'next/server'
import { db, tests, testGrades } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { findStudentsByBatch } from '@/lib/db/queries/students'
import { getLocalToday } from '@/lib/scheduleUtils'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return { test: null, forbidden: false }

  const role = (session.user as any).role
  const userId = (session.user as any).id as string
  const schoolId = getSchoolId(session)

  if (schoolId && test.schoolId !== schoolId) return { test: null, forbidden: false }
  if (role !== 'teacher' && role !== 'management') return { test, forbidden: true }
  // Row-level ownership mismatch is treated as "not found" rather than
  // "forbidden" — consistent with the rest of the tests API (schedule,
  // questions routes), which fold ownership into the lookup condition so a
  // non-owning teacher gets 404, not 403.
  if (role === 'teacher' && test.createdByUserId !== userId) return { test: null, forbidden: false }

  return { test, forbidden: false }
}

// Dense ranking over present, graded students only — an absent or ungraded
// student gets no rank at all rather than being sorted to the bottom.
function calculateRanks(rows: { studentId: string; marksObtained: number | null; absent: boolean }[]): Map<string, number> {
  const graded = rows
    .filter(r => !r.absent && r.marksObtained !== null)
    .sort((a, b) => (b.marksObtained as number) - (a.marksObtained as number))

  const rankByStudent = new Map<string, number>()
  let currentRank = 1
  graded.forEach((r, index) => {
    if (index > 0 && r.marksObtained !== graded[index - 1].marksObtained) currentRank = index + 1
    rankByStudent.set(r.studentId, currentRank)
  })
  return rankByStudent
}

// GET — real batch roster left-joined with any saved grades for this test.
// percentage/rank are always computed here, never stored.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const roster = await findStudentsByBatch(test.batch, test.schoolId)
    const grades = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    const gradeByStudent = new Map(grades.map(g => [g.studentId, g]))

    const ranks = calculateRanks(
      roster.map(s => {
        const g = gradeByStudent.get(s.id)
        return { studentId: s.id, marksObtained: g?.marksObtained ?? null, absent: g?.absent ?? false }
      })
    )

    const studentResults = roster.map(s => {
      const g = gradeByStudent.get(s.id)
      const marksObtained = g?.marksObtained ?? null
      const absent = g?.absent ?? false
      const percentage = !absent && marksObtained !== null
        ? Math.round((marksObtained / test.totalMarks) * 1000) / 10
        : null
      return {
        studentId: s.id,
        studentName: s.name,
        rollNo: s.rollNo || '',
        marksObtained,
        correct: g?.correct ?? null,
        incorrect: g?.incorrect ?? null,
        unattempted: g?.unattempted ?? null,
        absent,
        percentage,
        rank: ranks.get(s.id) ?? null,
      }
    })

    return NextResponse.json({ test, studentResults })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — upsert grades for the real batch roster. Only permitted once the
// test's own date has arrived.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { test, forbidden } = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (test.date > getLocalToday()) {
      return NextResponse.json({ error: 'This test cannot be graded before its scheduled date.' }, { status: 409 })
    }

    const body = await req.json()
    const grades = body.grades
    if (!Array.isArray(grades)) {
      return NextResponse.json({ error: 'Missing grades array.' }, { status: 400 })
    }

    const userId = (session.user as any).id as string
    const roster = await findStudentsByBatch(test.batch, test.schoolId)
    const rosterById = new Map(roster.map(s => [s.id, s]))

    for (const entry of grades) {
      const student = entry.studentId ? rosterById.get(entry.studentId) : undefined
      if (!student) continue

      const absent = !!entry.absent
      const toIntOrNull = (v: any) => (absent || v === undefined || v === null || v === '') ? null : Number(v)

      const values = {
        testId: test.id,
        studentId: student.id,
        rollNo: student.rollNo || '',
        marksObtained: toIntOrNull(entry.marksObtained),
        correct: toIntOrNull(entry.correct),
        incorrect: toIntOrNull(entry.incorrect),
        unattempted: toIntOrNull(entry.unattempted),
        absent,
        gradedByUserId: userId,
        schoolId: test.schoolId,
        updatedAt: new Date(),
      }

      const [existing] = await db.select().from(testGrades)
        .where(and(eq(testGrades.testId, test.id), eq(testGrades.studentId, student.id)))

      if (existing) {
        await db.update(testGrades).set(values).where(eq(testGrades.id, existing.id))
      } else {
        await db.insert(testGrades).values(values)
      }
    }

    const savedGrades = await db.select().from(testGrades).where(eq(testGrades.testId, test.id))
    const presentPercentages = savedGrades
      .filter(g => !g.absent && g.marksObtained !== null)
      .map(g => ((g.marksObtained as number) / test.totalMarks) * 100)
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

    return NextResponse.json({ success: true, test: updatedTest })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
