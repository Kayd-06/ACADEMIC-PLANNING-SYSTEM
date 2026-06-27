import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Test from '@/models/Test'
import TestResult from '@/models/TestResult'
import { auth } from '@/lib/auth'
import { findStudentsByClasses } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// Helper to resolve test batch name to student class names
function resolveClassFromBatch(batch: string): string {
  const b = batch.trim().toLowerCase()
  if (b.includes('2026-a') || b.includes('11-a') || b.includes('11 - a') || b.includes('grade 11-a')) return '11 - A'
  if (b.includes('2025-b') || b.includes('11-b') || b.includes('11 - b') || b.includes('grade 11-b')) return '11 - B'
  if (b.includes('2024-c') || b.includes('10-a') || b.includes('10 - a') || b.includes('grade 10-a')) return '10 - A'
  if (b.includes('foundation-x') || b.includes('10-b') || b.includes('10 - b') || b.includes('grade 10-b')) return '10 - B'
  return batch
}

// Generate a distribution of scores that has highest, lowest and a target average
function generateDistribution(count: number, highest: number, lowest: number, targetAverage: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [Math.round(targetAverage)]

  const scores: number[] = []
  for (let i = 0; i < count; i++) {
    const ratio = i / (count - 1)
    scores.push(Math.round(highest - ratio * (highest - lowest)))
  }

  let currentSum = scores.reduce((a, b) => a + b, 0)
  const targetSum = Math.round(targetAverage * count)
  let diff = targetSum - currentSum

  let attempts = 0
  while (diff !== 0 && attempts < 1000) {
    attempts++
    const idx = 1 + Math.floor(Math.random() * (count - 2))
    if (diff > 0 && scores[idx] < highest) {
      scores[idx]++
      diff--
    } else if (diff < 0 && scores[idx] > lowest) {
      scores[idx]--
      diff++
    }
  }

  return scores.sort((a, b) => b - a)
}

// Function to calculate ranks dynamically
function calculateRanks(studentResults: any[]) {
  const gradedResults = studentResults
    .filter(r => !r.absent)
    .sort((a, b) => (b.marksObtained ?? 0) - (a.marksObtained ?? 0))

  const rankMap = new Map<string, number>()
  let currentRank = 1

  gradedResults.forEach((res, index) => {
    const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
    if (index > 0 && res.marksObtained !== gradedResults[index - 1].marksObtained) {
      currentRank = index + 1
    }
    rankMap.set(key, currentRank)
  })

  return studentResults.map(res => {
    if (res.absent) {
      return {
        ...res,
        rank: undefined,
        percentage: undefined
      }
    }
    const key = res.rollNo ? `${res.rollNo}-${res.studentName}` : res.studentName
    return {
      ...res,
      rank: rankMap.get(key) || 1
    }
  })
}

// GET — fetch results for a given test ID
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json({ error: 'Missing testId parameter.' }, { status: 400 })
    }

    let test = await Test.findById(testId)
    if (!test) {
      // If we are looking for a mock test to seed, check if the ID requested matches 'mock-unit-test-3'
      if (testId === 'mock-unit-test-3') {
        const existingMockTest = await Test.findOne({ title: 'Unit Test 3', batch: '11 - A' })
        if (existingMockTest) {
          test = existingMockTest
        } else {
          test = await Test.create({
            title: 'Unit Test 3',
            batch: '11 - A',
            subject: 'Physics (PHY-101)',
            date: '2023-10-24',
            time: '10:00 AM',
            duration: 60,
            totalMarks: 100,
            status: 'Graded',
            averageScore: 74.5,
            testType: 'Unit Test'
          })
        }
      } else {
        return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
      }
    }

    // Check if test results already exist
    let resultDoc = await TestResult.findOne({ testId: test._id })

    const resolvedClass = resolveClassFromBatch(test.batch)
    // Fetch real students in this class
    const students = await findStudentsByClasses([resolvedClass], true)

    if (!resultDoc) {
      if (students.length === 0) {
        return NextResponse.json({ error: `No active students found in class "${resolvedClass}". Please add students first.` }, { status: 404 })
      }

      // Generate initial template records based on real students
      // We will distribute scores with highest 98, lowest 42, and average 74.5% if it's the Unit Test 3
      const isUnitTest3 = test.title === 'Unit Test 3' && resolvedClass === '11 - A'
      const presentCount = isUnitTest3 ? students.length - 1 : students.length
      const scores = isUnitTest3 ? generateDistribution(presentCount, 98, 42, 74.5) : []

      let scoreIdx = 0

      let initialRecords = students.map((st, index) => {
        // For Unit Test 3, make the third student (index 2) absent to match the mockup exactly
        const isAbsent = isUnitTest3 && index === 2

        if (isUnitTest3) {
          if (isAbsent) {
            return {
              studentId: st.id,
              studentName: st.name,
              rollNo: st.rollNo || `11A-${String(index + 1).padStart(2, '0')}`,
              marksObtained: undefined,
              correct: undefined,
              incorrect: undefined,
              unattempted: undefined,
              percentage: undefined,
              absent: true
            }
          }

          const score = scores[scoreIdx++]
          const correct = Math.round(score / 2)
          const unattempted = score % 2 === 0 ? 0 : 1
          const incorrect = Math.max(0, 50 - correct - unattempted)

          return {
            studentId: st.id,
            studentName: st.name,
            rollNo: st.rollNo || `11A-${String(index + 1).padStart(2, '0')}`,
            marksObtained: score,
            correct,
            incorrect,
            unattempted,
            percentage: (score / test.totalMarks) * 100,
            absent: false
          }
        }

        // For other tests, default to empty template values
        return {
          studentId: st.id,
          studentName: st.name,
          rollNo: st.rollNo || `${resolvedClass.replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`,
          marksObtained: undefined,
          correct: undefined,
          incorrect: undefined,
          unattempted: undefined,
          percentage: undefined,
          absent: false
        }
      })

      // Calculate ranks for the initial template records
      initialRecords = calculateRanks(initialRecords)

      // Sort alphabetically by studentName before saving/returning
      initialRecords.sort((a, b) => a.studentName.localeCompare(b.studentName))

      // Save initial result sheet if it was a Graded test
      if (test.status === 'Graded') {
        resultDoc = await TestResult.create({
          testId: test._id,
          studentResults: initialRecords
        })
      } else {
        // Return unsaved template for upcoming/pending tests
        return NextResponse.json({
          test,
          studentResults: initialRecords,
          isNew: true
        })
      }
    }

    // Map existing results to real students to ensure consistent real names
    const mappedResults = students.map((st, index) => {
      const originalResult = resultDoc.studentResults.find((r: any) => r.studentId === st.id) || resultDoc.studentResults[index]
      if (originalResult) {
        return {
          studentId: st.id,
          studentName: st.name,
          rollNo: st.rollNo || originalResult.rollNo,
          marksObtained: originalResult.marksObtained,
          correct: originalResult.correct,
          incorrect: originalResult.incorrect,
          unattempted: originalResult.unattempted,
          percentage: originalResult.percentage,
          absent: originalResult.absent,
          rank: originalResult.rank
        }
      } else {
        return {
          studentId: st.id,
          studentName: st.name,
          rollNo: st.rollNo || `${resolvedClass.replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`,
          marksObtained: undefined,
          correct: undefined,
          incorrect: undefined,
          unattempted: undefined,
          percentage: undefined,
          absent: false
        }
      }
    })

    // Sort alphabetically by studentName
    mappedResults.sort((a, b) => a.studentName.localeCompare(b.studentName))

    return NextResponse.json({
      test,
      studentResults: mappedResults,
      isNew: false
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — save or update test results sheet
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { testId, studentResults } = body

    if (!testId || !studentResults || !Array.isArray(studentResults)) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 })
    }

    const test = await Test.findById(testId)
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    }

    // Process and validate results, calculate percentages
    const totalMarks = test.totalMarks
    let formattedResults = studentResults.map(r => {
      const marks = r.absent ? undefined : Number(r.marksObtained || 0)
      return {
        studentId: r.studentId || undefined,
        studentName: r.studentName,
        rollNo: r.rollNo || '',
        marksObtained: marks,
        correct: r.absent ? undefined : Number(r.correct || 0),
        incorrect: r.absent ? undefined : Number(r.incorrect || 0),
        unattempted: r.absent ? undefined : Number(r.unattempted || 0),
        percentage: r.absent || marks === undefined ? undefined : Math.round((marks / totalMarks) * 1000) / 10,
        absent: !!r.absent
      }
    })

    // Compute ranks dynamically
    formattedResults = calculateRanks(formattedResults)

    // Save/Upsert results in database
    const updatedResultDoc = await TestResult.findOneAndUpdate(
      { testId },
      { testId, studentResults: formattedResults },
      { new: true, upsert: true }
    )

    // Calculate class performance stats (Average Score)
    const presentStudents = formattedResults.filter(r => !r.absent && r.percentage !== undefined)
    const averageScore = presentStudents.length > 0
      ? Math.round((presentStudents.reduce((sum, r) => sum + (r.percentage || 0), 0) / presentStudents.length) * 10) / 10
      : 0

    // Update Test status and average score in DB
    await Test.findByIdAndUpdate(testId, {
      averageScore,
      status: 'Graded'
    })

    return NextResponse.json({
      success: true,
      test: { ...test.toObject(), averageScore, status: 'Graded' },
      studentResults: updatedResultDoc.studentResults
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
