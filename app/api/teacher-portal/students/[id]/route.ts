import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Student from '@/models/Student'
import StudentReport from '@/models/StudentReport'
import CounselingSession from '@/models/CounselingSession'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const student = await Student.findById(params.id).lean()
    
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Find reports for this student. A report has a `students` array containing `{ name, rollNo, marks, maxMarks, grade }`
    // We match by rollNo or name
    const reports = await StudentReport.find({
      'students.rollNo': student.rollNo
    }).lean()

    // Map recent tests
    const recentTests = reports.map((r: any) => {
      const studentData = r.students.find((s: any) => s.rollNo === student.rollNo)
      return {
        test: `${r.term} - ${r.subject}`,
        date: new Date(r.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: studentData ? `${studentData.marks}/${studentData.maxMarks}` : 'N/A',
        percentage: studentData ? (studentData.marks / studentData.maxMarks) * 100 : 0
      }
    })

    // Calculate current performance averages by subject
    const subjectAverages: Record<string, { totalPercentage: number, count: number }> = {}
    reports.forEach((r: any) => {
      const studentData = r.students.find((s: any) => s.rollNo === student.rollNo)
      if (studentData) {
        const percentage = (studentData.marks / studentData.maxMarks) * 100
        if (!subjectAverages[r.subject]) {
          subjectAverages[r.subject] = { totalPercentage: 0, count: 0 }
        }
        subjectAverages[r.subject].totalPercentage += percentage
        subjectAverages[r.subject].count += 1
      }
    })

    const currentPerformance = Object.keys(subjectAverages).map(subject => ({
      subject,
      average: Math.round(subjectAverages[subject].totalPercentage / subjectAverages[subject].count)
    }))

    // Fetch counseling sessions
    const counseling = await CounselingSession.find({ studentName: student.name }).sort({ date: -1 }).lean()
    const counselingNotes = counseling.map((c: any) => ({
      date: new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      notes: c.notes || `Counseling session with ${c.counselor}`
    }))

    return NextResponse.json({
      student,
      recentTests,
      currentPerformance,
      counselingNotes,
      attendance: 92, // Mocked for now since we don't have a detailed attendance model
      attendanceDays: '42/45'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
