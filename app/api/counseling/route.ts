import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import CounselingSession from '@/models/CounselingSession'

export const dynamic = 'force-dynamic'

function getDateOffset(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

async function seedSessions() {
  const count = await CounselingSession.countDocuments({ duration: { $exists: true } })
  if (count > 0) return

  await CounselingSession.deleteMany({})

  const sessions = [
    { studentName: 'Aarav Sharma', studentInitials: 'AS', counselor: 'Dr. Anjali Sharma', type: 'Academic', date: getDateOffset(-1), time: '10:30 AM', duration: '45 mins', status: 'Completed', flagged: false, notes: 'Struggling with mathematics; follow-up after mid-term.' },
    { studentName: 'Maya Patel', studentInitials: 'MP', counselor: 'Mr. David Chen', type: 'Career', date: getDateOffset(-2), time: '2:00 PM', duration: '30 mins', status: 'Scheduled', flagged: false, notes: 'Discussed engineering college options and entrance exams.' },
    { studentName: 'Sarah Jenkins', studentInitials: 'SJ', counselor: 'Dr. Anjali Sharma', type: 'Disciplinary', date: getDateOffset(-3), time: '11:15 AM', duration: '15 mins', status: 'No-Show', flagged: true, notes: 'Student did not attend scheduled session. Follow up required.' },
    { studentName: 'Liam Miller', studentInitials: 'LM', counselor: 'Ms. Rebecca Torres', type: 'Disciplinary', date: getDateOffset(-4), time: '9:00 AM', duration: '30 mins', status: 'Cancelled', flagged: false, notes: 'Session cancelled due to school event.' },
    { studentName: 'Priya Nair', studentInitials: 'PN', counselor: 'Dr. Anjali Sharma', type: 'Academic', date: getDateOffset(2), time: '11:00 AM', duration: '45 mins', status: 'Scheduled', flagged: false, notes: 'Reviewing improvement plan for science subjects.' },
    { studentName: 'Ethan Brooks', studentInitials: 'EB', counselor: 'Mr. David Chen', type: 'Career', date: getDateOffset(3), time: '3:30 PM', duration: '60 mins', status: 'Scheduled', flagged: false, notes: 'Aptitude test review and career mapping session.' },
    { studentName: 'Aisha Gomez', studentInitials: 'AG', counselor: 'Ms. Rebecca Torres', type: 'Personal', date: getDateOffset(-5), time: '10:00 AM', duration: '45 mins', status: 'Completed', flagged: true, notes: 'Peer pressure issues discussed. Flagged for follow-up.' },
    { studentName: 'Rohan Verma', studentInitials: 'RV', counselor: 'Dr. Anjali Sharma', type: 'Disciplinary', date: getDateOffset(-6), time: '9:30 AM', duration: '30 mins', status: 'Completed', flagged: false, notes: 'Attendance discussion resolved.' },
    { studentName: 'Mei Lin', studentInitials: 'ML', counselor: 'Mr. David Chen', type: 'Academic', date: getDateOffset(1), time: '2:00 PM', duration: '30 mins', status: 'Scheduled', flagged: false, notes: 'Grade improvement strategy for upcoming finals.' },
    { studentName: 'James Wilson', studentInitials: 'JW', counselor: 'Ms. Rebecca Torres', type: 'Career', date: getDateOffset(-7), time: '4:00 PM', duration: '45 mins', status: 'No-Show', flagged: true, notes: 'Second consecutive no-show. Escalation needed.' },
    { studentName: 'Kavya Reddy', studentInitials: 'KR', counselor: 'Dr. Anjali Sharma', type: 'Personal', date: getDateOffset(-2), time: '12:00 PM', duration: '15 mins', status: 'Completed', flagged: false, notes: 'Stress management techniques shared.' },
    { studentName: 'David Osei', studentInitials: 'DO', counselor: 'Mr. David Chen', type: 'Academic', date: getDateOffset(7), time: '1:00 PM', duration: '45 mins', status: 'Scheduled', flagged: false, notes: 'Scholarship application guidance session.' },
    { studentName: 'Sophie Laurent', studentInitials: 'SL', counselor: 'Ms. Rebecca Torres', type: 'Career', date: getDateOffset(-8), time: '10:30 AM', duration: '30 mins', status: 'Completed', flagged: false, notes: 'Arts college portfolio reviewed.' },
    { studentName: 'Aryan Kapoor', studentInitials: 'AK', counselor: 'Dr. Anjali Sharma', type: 'Disciplinary', date: getDateOffset(-1), time: '9:00 AM', duration: '15 mins', status: 'Completed', flagged: true, notes: 'Bullying complaint investigated and resolved.' },
    { studentName: 'Nina Johansson', studentInitials: 'NJ', counselor: 'Mr. David Chen', type: 'Personal', date: getDateOffset(4), time: '11:30 AM', duration: '30 mins', status: 'Scheduled', flagged: false, notes: 'Anxiety management referral follow-up.' },
  ]

  await CounselingSession.insertMany(sessions)
}

// GET - fetch all sessions with optional filters
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    await seedSessions()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const counselor = searchParams.get('counselor')
    const flagged = searchParams.get('flagged')
    const search = searchParams.get('search')

    const query: Record<string, any> = {}
    if (status && status !== 'All') query.status = status
    if (type && type !== 'All') query.type = type
    if (counselor && counselor !== 'All') query.counselor = counselor
    if (flagged === 'true') query.flagged = true

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { counselor: { $regex: search, $options: 'i' } },
      ]
    }

    const sessions = await CounselingSession.find(query).sort({ date: -1, time: 1 }).lean()

    // Compute stats
    const all = await CounselingSession.find().lean()
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const sessionsThisWeek = all.filter(s => {
      const d = new Date(s.date)
      return d >= startOfWeek && d <= endOfWeek
    }).length

    const upcomingSessions = all.filter(s => {
      const d = new Date(s.date)
      return d >= now && s.status === 'Scheduled'
    }).length

    const noShowsThisMonth = all.filter(s => {
      const d = new Date(s.date)
      return d >= startOfMonth && d <= endOfMonth && s.status === 'No-Show'
    }).length

    const studentsFlagged = all.filter(s => s.flagged).length

    return NextResponse.json({
      sessions,
      stats: { sessionsThisWeek, upcomingSessions, noShowsThisMonth, studentsFlagged }
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - schedule a new session
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { studentName, counselor, type, date, time, notes, duration } = body

    if (!studentName?.trim() || !counselor?.trim() || !type || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const initials = studentName.trim().split(' ')
      .map((n: string) => n[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('')

    const session = await CounselingSession.create({
      studentName: studentName.trim(),
      studentInitials: initials,
      counselor: counselor.trim(),
      type,
      date,
      time,
      status: 'Scheduled',
      notes: notes?.trim() || '',
      duration: duration || '30 mins',
      flagged: false
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - update session status or flag
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { id, status, flagged, notes, duration } = body

    if (!id) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (status !== undefined) updates.status = status
    if (flagged !== undefined) updates.flagged = flagged
    if (notes !== undefined) updates.notes = notes
    if (duration !== undefined) updates.duration = duration

    const updated = await CounselingSession.findByIdAndUpdate(id, updates, { new: true })
    if (!updated) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - remove a session
export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 })

    const deleted = await CounselingSession.findByIdAndDelete(id)
    if (!deleted) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
