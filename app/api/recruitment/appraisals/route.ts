import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Appraisal from '@/models/Appraisal'

const DEFAULT_APPRAISALS = [
  // Completed (recent)
  { facultyName: 'Prof. Alice Vance', department: 'Department of History', reviewType: 'Q3 Academic Review', rating: 'Excellent', notes: 'Completed Q3 Academic Review. Outstanding student feedback and published two major papers.', isCompleted: true, avatarInitials: 'AV' },
  { facultyName: 'Dr. Robert Chen', department: 'Engineering Faculty', reviewType: 'Annual Review', rating: 'Satisfactory', notes: 'Completed Annual Review. Met all teaching requirements; advised on increasing research output.', isCompleted: true, avatarInitials: 'RC' },
  // Upcoming
  { facultyName: 'Dr. Linda Martinez', department: 'Sciences', reviewType: 'Tenure Review', scheduledDate: 'Oct 18', scheduledTime: '10:00 AM', isCompleted: false, avatarInitials: 'LM' },
  { facultyName: 'Prof. David Kim', department: 'Mathematics', reviewType: 'Annual Performance', scheduledDate: 'Oct 20', scheduledTime: '02:30 PM', isCompleted: false, avatarInitials: 'DK' },
  { facultyName: 'Sarah Jenkins', department: 'Computer Science', reviewType: 'Probationary Review', scheduledDate: 'Oct 25', scheduledTime: '11:00 AM', isCompleted: false, avatarInitials: 'SJ' },
]

export async function GET() {
  try {
    await connectDB()
    let appraisals = await Appraisal.find().sort({ createdAt: -1 })
    if (appraisals.length === 0) {
      await Appraisal.insertMany(DEFAULT_APPRAISALS)
      appraisals = await Appraisal.find().sort({ createdAt: -1 })
    }
    return NextResponse.json(appraisals)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const appraisal = await Appraisal.create(body)
    return NextResponse.json(appraisal)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const { id, ...update } = body
    const appraisal = await Appraisal.findByIdAndUpdate(id, update, { new: true })
    return NextResponse.json(appraisal)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    await Appraisal.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
