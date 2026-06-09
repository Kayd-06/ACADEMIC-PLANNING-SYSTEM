import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StudentReport from '@/models/StudentReport'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    let reports
    if (session.user.role === 'management') {
      // Admins see all reports
      reports = await StudentReport.find({}).sort({ uploadedAt: -1 }).lean()
    } else {
      // Teachers see only their own
      reports = await StudentReport.find({ teacherId: session.user.id }).sort({ uploadedAt: -1 }).lean()
      
      // Check if we need to seed or re-seed with full term history
      const hasFullHistory = reports.some(r => r.term === 'Finals')
      if (reports.length === 0 || !hasFullHistory) {
        // Delete existing reports to avoid duplicate entries for the same teacher
        await StudentReport.deleteMany({ teacherId: session.user.id })

        await StudentReport.insertMany([
          // Unit Test 1
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Physics',
            term: 'Unit Test 1',
            uploadedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B', attendance: 95, remarks: 'Good grasp of basics, but needs practice in problem solving.' },
              { name: 'Priya Patel', rollNo: '102', marks: 88, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Very attentive and shows excellent logic.' },
              { name: 'Amit Verma', rollNo: '103', marks: 65, maxMarks: 100, grade: 'C', attendance: 88, remarks: 'Needs to focus more during class and complete homework.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 50, maxMarks: 100, grade: 'D', attendance: 76, remarks: 'Struggling with fundamentals. Recommending extra classes.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Mathematics',
            term: 'Unit Test 1',
            uploadedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 85, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Strong arithmetic skills.' },
              { name: 'Priya Patel', rollNo: '102', marks: 92, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Brilliant conceptual clarity.' },
              { name: 'Amit Verma', rollNo: '103', marks: 72, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Participates well but makes silly mistakes.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 58, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Needs constant encouragement and supervision.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Chemistry',
            term: 'Unit Test 1',
            uploadedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 70, maxMarks: 100, grade: 'B', attendance: 95, remarks: 'Requires revision in organic chemistry.' },
              { name: 'Priya Patel', rollNo: '102', marks: 85, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Good laboratory skills.' },
              { name: 'Amit Verma', rollNo: '103', marks: 60, maxMarks: 100, grade: 'C', attendance: 88, remarks: 'Needs to study definitions and chemical equations.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 45, maxMarks: 100, grade: 'F', attendance: 76, remarks: 'Fails to submit chemistry assignments on time.' }
            ]
          },
          // Mid-Term
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Physics',
            term: 'Mid-Term',
            uploadedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 78, maxMarks: 100, grade: 'B+', attendance: 95, remarks: 'Showing steady improvement. Good progress.' },
              { name: 'Priya Patel', rollNo: '102', marks: 90, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Consistently outstanding.' },
              { name: 'Amit Verma', rollNo: '103', marks: 68, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Better scores this term. Keep it up.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 52, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Slight improvement in grades, but needs constant effort.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Mathematics',
            term: 'Mid-Term',
            uploadedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 88, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Well organized and precise.' },
              { name: 'Priya Patel', rollNo: '102', marks: 94, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Excellent score, solves advanced puzzles.' },
              { name: 'Amit Verma', rollNo: '103', marks: 75, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Steady logic. Needs to practice geometry.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 60, maxMarks: 100, grade: 'B', attendance: 76, remarks: 'Improved score. Can do even better.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Chemistry',
            term: 'Mid-Term',
            uploadedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 72, maxMarks: 100, grade: 'B', attendance: 95, remarks: 'Active in class discussions.' },
              { name: 'Priya Patel', rollNo: '102', marks: 87, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Impressive experimental reports.' },
              { name: 'Amit Verma', rollNo: '103', marks: 62, maxMarks: 100, grade: 'C', attendance: 88, remarks: 'Must work on numerical calculations.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 48, maxMarks: 100, grade: 'D', attendance: 76, remarks: 'Better classroom presence but needs tutorial help.' }
            ]
          },
          // Unit Test 2
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Physics',
            term: 'Unit Test 2',
            uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 82, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Good analytical answers in mechanics.' },
              { name: 'Priya Patel', rollNo: '102', marks: 92, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Superb focus and execution.' },
              { name: 'Amit Verma', rollNo: '103', marks: 72, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Consistent efforts have paid off.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 55, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Needs to review core formulas daily.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Mathematics',
            term: 'Unit Test 2',
            uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 90, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Exceptional work in trigonometry.' },
              { name: 'Priya Patel', rollNo: '102', marks: 95, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Outstanding performance.' },
              { name: 'Amit Verma', rollNo: '103', marks: 78, maxMarks: 100, grade: 'B+', attendance: 88, remarks: 'Good progress in calculus basics.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 62, maxMarks: 100, grade: 'B', attendance: 76, remarks: 'Consistent grades, showing diligence.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Chemistry',
            term: 'Unit Test 2',
            uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B', attendance: 95, remarks: 'Demonstrates deep interest in electrochemistry.' },
              { name: 'Priya Patel', rollNo: '102', marks: 89, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'High quality coursework.' },
              { name: 'Amit Verma', rollNo: '103', marks: 65, maxMarks: 100, grade: 'C', attendance: 88, remarks: 'Satisfactory marks, but focus is essential.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 50, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Gaining confidence in lab reports.' }
            ]
          },
          // Pre-Board
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Physics',
            term: 'Pre-Board',
            uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 85, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Excellent logical skills. Well prepared for final boards.' },
              { name: 'Priya Patel', rollNo: '102', marks: 94, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Perfect methodology in solving physics derivations.' },
              { name: 'Amit Verma', rollNo: '103', marks: 74, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Good improvement. Prepared well.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 58, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Needs to practice numerical questions more extensively.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Mathematics',
            term: 'Pre-Board',
            uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 92, maxMarks: 100, grade: 'A+', attendance: 95, remarks: 'Very methodical and quick.' },
              { name: 'Priya Patel', rollNo: '102', marks: 96, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Phenomenal performance.' },
              { name: 'Amit Verma', rollNo: '103', marks: 82, maxMarks: 100, grade: 'A', attendance: 88, remarks: 'Capable of achieving top scores with practice.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 65, maxMarks: 100, grade: 'B', attendance: 76, remarks: 'Shows good understanding of main theorems.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Chemistry',
            term: 'Pre-Board',
            uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 78, maxMarks: 100, grade: 'B+', attendance: 95, remarks: 'Solid performance. Revise periodic tables.' },
              { name: 'Priya Patel', rollNo: '102', marks: 91, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Understands complex equations very well.' },
              { name: 'Amit Verma', rollNo: '103', marks: 70, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Good grasp of stoichiometry.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 52, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Sufficient knowledge, needs more mock test practice.' }
            ]
          },
          // Finals
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Physics',
            term: 'Finals',
            uploadedAt: new Date(),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 88, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Outstanding performance. Has shown immense growth.' },
              { name: 'Priya Patel', rollNo: '102', marks: 96, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Brilliant throughout the academic year. Exceptional.' },
              { name: 'Amit Verma', rollNo: '103', marks: 78, maxMarks: 100, grade: 'B+', attendance: 88, remarks: 'Very good final result. Hard work has paid off.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 62, maxMarks: 100, grade: 'B', attendance: 76, remarks: 'Passed with decent marks. Showing steady progress.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Mathematics',
            term: 'Finals',
            uploadedAt: new Date(),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 95, maxMarks: 100, grade: 'A+', attendance: 95, remarks: 'Outstanding math scores. Deep analytic thinker.' },
              { name: 'Priya Patel', rollNo: '102', marks: 98, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Highest scorer. Superb logical reasoning capabilities.' },
              { name: 'Amit Verma', rollNo: '103', marks: 85, maxMarks: 100, grade: 'A', attendance: 88, remarks: 'Fabulous performance in calculus and algebra.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 70, maxMarks: 100, grade: 'B', attendance: 76, remarks: 'Commendable effort. Improved grade significantly.' }
            ]
          },
          {
            teacherId: session.user.id,
            teacherName: session.user.name ?? 'Faculty',
            className: 'Grade 10-A',
            subject: 'Chemistry',
            term: 'Finals',
            uploadedAt: new Date(),
            students: [
              { name: 'Rahul Sharma', rollNo: '101', marks: 80, maxMarks: 100, grade: 'A', attendance: 95, remarks: 'Commendable work, especially in organic chemistry.' },
              { name: 'Priya Patel', rollNo: '102', marks: 93, maxMarks: 100, grade: 'A+', attendance: 98, remarks: 'Exemplary performance across theoretical and practical exams.' },
              { name: 'Amit Verma', rollNo: '103', marks: 74, maxMarks: 100, grade: 'B', attendance: 88, remarks: 'Good grasp of equations. Very tidy presentation.' },
              { name: 'Sneha Reddy', rollNo: '104', marks: 56, maxMarks: 100, grade: 'C', attendance: 76, remarks: 'Familiar with concepts, needs slightly more numerical practice.' }
            ]
          }
        ])
        reports = await StudentReport.find({ teacherId: session.user.id }).sort({ uploadedAt: -1 }).lean()
      }
    }

    return NextResponse.json(reports, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (err) {
    console.error('[student-reports GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can upload reports' }, { status: 403 })
    }

    const body = await req.json()
    const { className, subject, term, students } = body

    if (!className || !subject || !term || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await connectDB()

    const report = await StudentReport.create({
      teacherId: session.user.id,
      teacherName: session.user.name,
      className,
      subject,
      term,
      students,
      uploadedAt: new Date(),
    })

    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    console.error('[student-reports POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
