import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import TeacherSchedule from '@/models/TeacherSchedule'
import StudentCounseling from '@/models/StudentCounseling'
import StudyMaterial from '@/models/StudyMaterial'
import TeacherFeedback from '@/models/TeacherFeedback'

export async function GET() {
  try {
    await connectDB()
    
    const [schedule, counseling, materials, feedback] = await Promise.all([
      TeacherSchedule.find().sort({ createdAt: 1 }),
      StudentCounseling.find().sort({ createdAt: -1 }),
      StudyMaterial.find().sort({ createdAt: 1 }),
      TeacherFeedback.find().sort({ createdAt: -1 })
    ])

    // Seed if empty
    if (schedule.length === 0) {
      await TeacherSchedule.insertMany([
        { time: '09:00 AM', activity: 'Test Conduction: Physics Mid-Term', batch: 'Batch A1', location: 'Hall B', status: 'Upcoming' },
        { time: '11:30 AM', activity: 'Periodic Visit: Study Hall Supervision', batch: 'Library Wing C', location: 'Library', status: 'Pending' },
        { time: '02:00 PM', activity: 'Doubt Clearing Session', batch: 'Batch B2', location: 'Room 405', status: 'Pending' }
      ])
    }
    if (counseling.length === 0) {
      await StudentCounseling.insertMany([
        { studentName: 'Rahul Sharma', category: 'Attendance', description: 'Missed last 3 tutorials. Needs immediate follow-up regarding...' },
        { studentName: 'Priya Patel', category: 'Behavior', description: 'Excellent improvement in class participation. Marked as...' }
      ])
    }
    if (materials.length === 0) {
      await StudyMaterial.insertMany([
        { provider: 'Allen Modules', count: 45, type: 'PDFs', subject: 'Physics', initials: 'AL' },
        { provider: 'Aakash Bank', count: 120, type: 'Tests', subject: 'PCM', initials: 'AK' },
        { provider: 'Motion DPPS', count: 30, type: 'Daily Practice', subject: 'Physics', initials: 'MO' }
      ])
    }
    if (feedback.length === 0) {
      await TeacherFeedback.insertMany([
        { from: 'Student (Batch A1)', context: '2 days ago', content: '"The mid-term review session was extremely helpful for clarifying electromagnetism concepts."', type: 'student' },
        { from: 'Academic Coordinator', context: '1 week ago', content: '"Syllabus coverage is exactly on track. Good utilization of the Motion study material in class."', type: 'coordinator' }
      ])
    }

    return NextResponse.json({
      schedule: await TeacherSchedule.find().sort({ createdAt: 1 }),
      counseling: await StudentCounseling.find().sort({ createdAt: -1 }),
      materials: await StudyMaterial.find().sort({ createdAt: 1 }),
      feedback: await TeacherFeedback.find().sort({ createdAt: -1 })
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
