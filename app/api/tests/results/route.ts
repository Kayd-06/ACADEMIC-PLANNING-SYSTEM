import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import TestResult from '@/models/TestResult'
import { auth } from '@/lib/auth'
import { findStudentsByClasses } from '@/lib/db/queries/students'
import { notifyRoleInSchool } from '@/lib/notify'
import { db, tests, schools, students } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const FALLBACK_FILE = path.join(process.cwd(), '.next/test_results_fallback.json')

function getFallbackResults(testId: string): any {
  if (!fs.existsSync(FALLBACK_FILE)) return null
  try {
    const data = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'))
    return data[testId] || null
  } catch (e) {
    return null
  }
}

function saveFallbackResults(testId: string, studentResults: any[]) {
  let data: Record<string, any> = {}
  if (fs.existsSync(FALLBACK_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'))
    } catch (e) {
      data = {}
    }
  }
  data[testId] = {
    testId,
    studentResults,
    updatedAt: new Date().toISOString()
  }
  const dir = path.dirname(FALLBACK_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2))
}

// Helper to resolve test batch name to student class names
function resolveClassFromBatch(batch: string): string {
  const b = batch.trim().toLowerCase()
  if (b.includes('2026-a') || b.includes('11-a') || b.includes('11 - a') || b.includes('grade 11-a') || b.includes('batch a')) return '11 - A'
  if (b.includes('2025-b') || b.includes('11-b') || b.includes('11 - b') || b.includes('grade 11-b') || b.includes('batch b')) return '11 - B'
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

    let isMongoOffline = false
    try {
      await connectDB()
    } catch (e) {
      console.warn("MongoDB connection failed on GET, using local fallback:", e)
      isMongoOffline = true
    }

    const { searchParams } = new URL(req.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json({ error: 'Missing testId parameter.' }, { status: 400 })
    }

    const targetTestId = testId === 'mock-unit-test-3' ? '00000000-0000-0000-0000-000000000003' : testId
    const schoolId = (session.user as any).schoolId as string | null

    let [test] = await db.select().from(tests).where(eq(tests.id, targetTestId))
    if (!test) {
      if (testId === 'mock-unit-test-3' || targetTestId === '00000000-0000-0000-0000-000000000003') {
        // Clear any existing test and results to start clean
        await db.delete(tests).where(eq(tests.id, '00000000-0000-0000-0000-000000000003'))
        if (!isMongoOffline) {
          try {
            await TestResult.deleteOne({ testId: '00000000-0000-0000-0000-000000000003' })
          } catch (e) {
            console.error("Failed to delete MongoDB results:", e)
          }
        }
        if (fs.existsSync(FALLBACK_FILE)) {
          try {
            const data = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'))
            if (data['00000000-0000-0000-0000-000000000003']) {
              delete data['00000000-0000-0000-0000-000000000003']
              fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2))
            }
          } catch (e) {}
        }

        const [created] = await db.insert(tests).values({
          id: '00000000-0000-0000-0000-000000000003',
          title: 'Unit Test 3',
          batch: 'Batch A',
          subject: 'Physics (PHY-101)',
          date: '2023-10-24',
          time: '10:00 AM',
          duration: 60,
          totalMarks: 100,
          status: 'Pending Grading',
          averageScore: null,
          testType: 'Unit Test',
          schoolId
        }).returning()
        test = created
      } else {
        return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
      }
    }

    // Check if test results already exist
    let resultDoc = null
    if (!isMongoOffline) {
      try {
        resultDoc = await TestResult.findOne({ testId: test.id })
      } catch (e) {
        console.error("Failed to query MongoDB, using local fallback:", e)
        isMongoOffline = true
      }
    }

    if (isMongoOffline) {
      resultDoc = getFallbackResults(test.id)
    }

    const resolvedClass = resolveClassFromBatch(test.batch)
    
    // Delete any unassigned mock students in class '11 - A' to force recreation with batch
    if (testId === 'mock-unit-test-3' || targetTestId === '00000000-0000-0000-0000-000000000003') {
      const deleteCondition = schoolId
        ? and(eq(students.class, '11 - A'), eq(students.batch, ''), eq(students.schoolId, schoolId))
        : and(eq(students.class, '11 - A'), eq(students.batch, ''))
      await db.delete(students).where(deleteCondition)
    }

    // Fetch real students in this class
    let studentsList = await findStudentsByClasses([resolvedClass], true, schoolId)

    // Auto-seed mock students if class '11 - A' has no students
    if (studentsList.length === 0 && (testId === 'mock-unit-test-3' || targetTestId === '00000000-0000-0000-0000-000000000003')) {
      const mockStudentData = [
        { name: 'Kunal Dadlani', rollNo: '11A-01', class: '11 - A', section: 'A', program: 'Science', batch: 'Batch A', schoolId },
        { name: 'Ayush Patel', rollNo: '11A-02', class: '11 - A', section: 'A', program: 'Science', batch: 'Batch A', schoolId },
        { name: 'Kunal Singhi', rollNo: '11A-03', class: '11 - A', section: 'A', program: 'Science', batch: 'Batch A', schoolId },
      ]
      
      const insertedStudents = await Promise.all(
        mockStudentData.map(st => db.insert(students).values(st).returning())
      )
      studentsList = insertedStudents.map(rows => rows[0])
    }

    if (!resultDoc) {
      if (studentsList.length === 0) {
        return NextResponse.json({ error: `No active students found in class "${resolvedClass}". Please add students first.` }, { status: 404 })
      }

      // Generate initial template records based on real students
      let initialRecords = studentsList.map((st, index) => {
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

      initialRecords.sort((a, b) => a.studentName.localeCompare(b.studentName))

      if (test.status === 'Graded') {
        if (!isMongoOffline) {
          try {
            resultDoc = await TestResult.create({
              testId: test.id,
              studentResults: initialRecords
            })
          } catch (e) {
            console.error("Failed to create in MongoDB, saving locally:", e)
            saveFallbackResults(test.id, initialRecords)
            resultDoc = { testId: test.id, studentResults: initialRecords }
          }
        } else {
          saveFallbackResults(test.id, initialRecords)
          resultDoc = { testId: test.id, studentResults: initialRecords }
        }
      } else {
        return NextResponse.json({
          test,
          studentResults: initialRecords,
          isNew: true
        })
      }
    }

    // Map existing results to real students
    const mappedResults = studentsList.map((st, index) => {
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

    let isMongoOffline = false
    try {
      await connectDB()
    } catch (e) {
      console.warn("MongoDB connection failed on POST, using local fallback:", e)
      isMongoOffline = true
    }

    const body = await req.json()
    const { testId, studentResults } = body

    if (!testId || !studentResults || !Array.isArray(studentResults)) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 })
    }

    const [test] = await db.select().from(tests).where(eq(tests.id, testId))
    if (!test) {
      return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    }

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

    formattedResults = calculateRanks(formattedResults)

    let updatedResultDoc = null
    if (!isMongoOffline) {
      try {
        updatedResultDoc = await TestResult.findOneAndUpdate(
          { testId },
          { testId, studentResults: formattedResults },
          { new: true, upsert: true }
        )
      } catch (e) {
        console.error("Failed to update MongoDB, writing locally:", e)
        isMongoOffline = true
      }
    }

    if (isMongoOffline) {
      saveFallbackResults(testId, formattedResults)
      updatedResultDoc = { testId, studentResults: formattedResults }
    }

    const presentStudents = formattedResults.filter(r => !r.absent && r.percentage !== undefined)
    const averageScore = presentStudents.length > 0
      ? Math.round((presentStudents.reduce((sum, r) => sum + (r.percentage || 0), 0) / presentStudents.length) * 10) / 10
      : 0

    await db.update(tests).set({
      averageScore: Math.round(averageScore),
      status: 'Graded',
      updatedAt: new Date()
    }).where(eq(tests.id, testId))

    await notifyRoleInSchool(
      ['teacher', 'management'],
      test.schoolId,
      {
        category: 'Result',
        title: `Test Results Declared: ${test.title}`,
        message: `Results for Subject: ${test.subject} (Batch: ${test.batch}) have been declared. Class Average: ${averageScore}%.`,
      },
      (role) => role === 'teacher' ? '/teacher/tests' : '/management/tests-bank'
    )

    return NextResponse.json({
      success: true,
      test: { ...test, averageScore, status: 'Graded' },
      studentResults: updatedResultDoc.studentResults
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
