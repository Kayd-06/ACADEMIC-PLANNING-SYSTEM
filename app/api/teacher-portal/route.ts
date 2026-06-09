import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import TeacherSchedule from '@/models/TeacherSchedule'
import StudentCounseling from '@/models/StudentCounseling'
import StudyMaterial from '@/models/StudyMaterial'
import TeacherFeedback from '@/models/TeacherFeedback'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    const today = d.toISOString().split('T')[0]

    const [schedule, counseling, materials, feedback] = await Promise.all([
      TeacherSchedule.find().sort({ createdAt: 1 }),
      StudentCounseling.find().sort({ createdAt: -1 }),
      StudyMaterial.find().sort({ createdAt: 1 }),
      TeacherFeedback.find().sort({ createdAt: -1 })
    ])

    // Seed if empty for today
    let todaySchedules = await TeacherSchedule.find({ date: today }).sort({ time: 1 })
    if (todaySchedules.length === 0) {
      await TeacherSchedule.insertMany([
        { date: today, time: '09:00 AM', activity: 'Test Conduction: Physics Mid-Term', batch: 'Batch A1', location: 'Hall B', status: 'Upcoming' },
        { date: today, time: '11:30 AM', activity: 'Periodic Visit: Study Hall Supervision', batch: 'Library Wing C', location: 'Library', status: 'Pending' },
        { date: today, time: '02:00 PM', activity: 'Doubt Clearing Session', batch: 'Batch B2', location: 'Room 405', status: 'Pending' }
      ])
      todaySchedules = await TeacherSchedule.find({ date: today }).sort({ time: 1 })
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
      schedule: todaySchedules,
      counseling: await StudentCounseling.find().sort({ createdAt: -1 }),
      materials: await StudyMaterial.find().sort({ createdAt: 1 }),
      feedback: await TeacherFeedback.find().sort({ createdAt: -1 })
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
