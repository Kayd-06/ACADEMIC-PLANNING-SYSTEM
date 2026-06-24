import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import CalendarEvent from '@/models/CalendarEvent'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to get current year dynamically (defaults to 2026)
const currentYearVal = new Date().getFullYear()

// Mock calendar events for seeding relative to current year
const MOCK_EVENTS = [
  {
    title: 'Summer Vacation',
    date: `${currentYearVal}-06-01`,
    endDate: `${currentYearVal}-06-10`,
    type: 'Holiday',
    scope: 'School-wide',
    description: 'Summer break. School reopens on June 11th.'
  },
  {
    title: 'Mid-Term Exams',
    date: `${currentYearVal}-06-15`,
    endDate: `${currentYearVal}-06-18`,
    type: 'Exam/Test',
    scope: 'Grade 11 & 12',
    description: 'First semester mid-term examinations.'
  },
  {
    title: 'Annual Sports Day',
    date: `${currentYearVal}-06-21`,
    type: 'Event',
    scope: 'School-wide',
    description: 'Annual track & field sports meet.'
  },
  {
    title: 'Parent-Teacher Meeting',
    date: `${currentYearVal}-06-24`,
    type: 'Parent Meeting',
    scope: 'Grade 11',
    description: 'PTM to discuss academic planning and midterm performance.'
  },
  {
    title: 'Dussehra Holiday',
    date: `${currentYearVal}-10-12`,
    type: 'Holiday',
    scope: 'School-wide',
    description: 'Holiday observed for Dussehra festival celebrations.'
  },
  {
    title: 'Unit Test Begins',
    date: `${currentYearVal}-10-15`,
    endDate: `${currentYearVal}-10-17`,
    type: 'Exam/Test',
    scope: 'Batch A',
    description: 'Unit test runs through Oct 17th.'
  },
  {
    title: 'PTM',
    date: `${currentYearVal}-10-24`,
    type: 'Parent Meeting',
    scope: 'Grade 11',
    description: 'Parent Teacher Meeting to discuss academic planning.'
  },
  {
    title: 'Diwali Break',
    date: `${currentYearVal}-11-10`,
    endDate: `${currentYearVal}-11-14`,
    type: 'Holiday',
    scope: 'School-wide',
    description: 'Diwali festival holidays.'
  },
  {
    title: 'Christmas Carnival',
    date: `${currentYearVal}-12-23`,
    type: 'Event',
    scope: 'School-wide',
    description: 'Christmas celebration and food stalls.'
  },
  {
    title: 'Winter Holidays',
    date: `${currentYearVal}-12-24`,
    endDate: `${currentYearVal + 1}-01-01`,
    type: 'Holiday',
    scope: 'School-wide',
    description: 'Winter break vacation.'
  }
]

// GET — load all calendar events (with seeding check)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const count = await CalendarEvent.countDocuments()
    if (count === 0) {
      await CalendarEvent.insertMany(MOCK_EVENTS)
    }

    const events = await CalendarEvent.find().sort({ date: 1 }).lean()
    return NextResponse.json(events)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create new calendar event
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { title, date, endDate, type, scope, description } = body

    if (!title?.trim() || !date || !type || !scope?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const event = await CalendarEvent.create({
      title: title.trim(),
      date,
      endDate: endDate || undefined,
      type,
      scope: scope.trim(),
      description: description || ''
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — update calendar event
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { id, title, date, endDate, type, scope, description } = body

    if (!id || !title?.trim() || !date || !type || !scope?.trim()) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const event = await CalendarEvent.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        date,
        endDate: endDate || undefined,
        type,
        scope: scope.trim(),
        description: description || ''
      },
      { new: true }
    )

    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    return NextResponse.json(event)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — remove calendar event
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const role = (session.user as any).role
    if (role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing event ID.' }, { status: 400 })

    const event = await CalendarEvent.findByIdAndDelete(id)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
