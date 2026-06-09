import { NextResponse } from 'next/server'
import { Milestone, PlanningLog, AcademicMetric } from '@/models/AcademicPlanning'
import mongoose from 'mongoose'

export const dynamic = 'force-dynamic'

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables')
  }
  await mongoose.connect(process.env.MONGODB_URI)
}

export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    if (!role) return NextResponse.json({ error: 'Role is required' }, { status: 400 })

    const count = await Milestone.countDocuments()
    if (count === 0) {
      await Milestone.insertMany([
        { name: 'Annual Quality Audit', type: 'Institutional', date: '2024-10-30', subject: 'All Departments', status: 'Pending', role: 'management' },
        { name: 'Faculty Performance Review', type: 'Internal', date: '2024-11-05', subject: 'Academic Staff', status: 'Scheduled', role: 'management' },
        { name: 'Physics Unit 4', type: 'Fortnightly', date: '2024-10-15', subject: 'Grade 11 • Physics', status: 'Scheduled', role: 'teacher' },
        { name: 'Math Quiz 2', type: 'Weekly', date: '2024-10-20', subject: 'Grade 10 • Math', status: 'Scheduled', role: 'teacher' },
      ])
      await PlanningLog.insertMany([
        { title: 'Institutional Compliance Audit', focus: 'Safety and Academic Standards for 2024-25.', type: 'review', measure: 'Allocate $25k for lab equipment upgrades.', measureLabel: 'Budget Allocation:', role: 'management' },
        { title: 'Science Dept. Periodic Review', focus: 'Grade 10 Physics Mid-term results analysis.', type: 'review', measure: 'Schedule additional tutorial sessions for mechanics.', measureLabel: 'Corrective Measure:', role: 'teacher' },
        { title: 'Curriculum Sync', focus: 'Aligning Grade 11 syllabus with board standards.', type: 'sync', measure: 'Updated lesson plans for the next 3 weeks.', measureLabel: 'Action Item:', role: 'teacher' },
      ])
      await AcademicMetric.insertMany([
        { label: 'Overall GPA', value: '3.6', trend: '+0.2', role: 'management', category: 'header_stat' },
        { label: 'Staff Capacity', value: '92%', trend: '-2%', role: 'management', category: 'header_stat' },
        { label: 'Budget Util.', value: '64%', trend: '+4%', role: 'management', category: 'header_stat' },
        { label: 'Course Progress', value: '78%', trend: '+5%', role: 'teacher', category: 'header_stat' },
        { label: 'Avg Attendance', value: '94%', trend: '+1%', role: 'teacher', category: 'header_stat' },
        { label: 'Assignment Completion', value: '86%', trend: '+2%', role: 'teacher', category: 'header_stat' },
        { label: 'Staff Retention', value: '96.8%', trend: '+0.8%', role: 'management', category: 'quality_stat', chartData: [40, 70, 45, 90, 65, 80, 50] },
        { label: 'Student Performance', value: '88.5%', trend: '+3.4%', role: 'teacher', category: 'quality_stat', chartData: [30, 60, 50, 85, 70, 75, 80] },
      ])
    }

    const milestones = await Milestone.find({ role }).sort({ date: 1 })
    const logs = await PlanningLog.find({ role }).sort({ createdAt: -1 })
    const metrics = await AcademicMetric.find({ role })

    return NextResponse.json({ milestones, logs, metrics }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { modelType, ...data } = body

    if (modelType === 'milestone') {
      const newItem = await Milestone.create(data)
      return NextResponse.json(newItem)
    } else if (modelType === 'log') {
      const newItem = await PlanningLog.create(data)
      return NextResponse.json(newItem)
    }
    
    return NextResponse.json({ error: 'Invalid modelType' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { id, modelType, ...updates } = body

    let updatedItem
    if (modelType === 'milestone') {
      updatedItem = await Milestone.findByIdAndUpdate(id, updates, { new: true })
    } else if (modelType === 'log') {
      updatedItem = await PlanningLog.findByIdAndUpdate(id, updates, { new: true })
    } else if (modelType === 'metric') {
      updatedItem = await AcademicMetric.findByIdAndUpdate(id, updates, { new: true })
    }

    if (!updatedItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json(updatedItem)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')

    if (!id || !type) return NextResponse.json({ error: 'ID and Type are required' }, { status: 400 })

    if (type === 'milestone') {
      await Milestone.findByIdAndDelete(id)
    } else if (type === 'log') {
      await PlanningLog.findByIdAndDelete(id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
