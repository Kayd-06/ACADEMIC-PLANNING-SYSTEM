import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import StudentReport from '@/models/StudentReport'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    const reports = await StudentReport.find().sort({ createdAt: -1 }).lean()
    
    const formattedReports = reports.map((rep: any) => {
      let totalMarks = 0
      let totalMax = 0
      rep.students.forEach((s: any) => {
        totalMarks += s.marks
        totalMax += s.maxMarks
      })
      const avgScore = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
      
      return {
        _id: rep._id.toString(),
        class: rep.className,
        sub: rep.subject,
        term: rep.term,
        students: rep.students.length,
        avg: `${avgScore}%`,
        date: new Date(rep.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      }
    })

    return NextResponse.json(formattedReports)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const { className, subject, term, students } = body

    if (!className || !subject || !term || !students || students.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or student data' }, { status: 400 })
    }

    const report = new StudentReport({
      className,
      subject,
      term,
      students
    })

    await report.save()

    return NextResponse.json({ success: true, report }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
