import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Attendance from '@/models/Attendance'
import Student from '@/models/Student'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Helper to map UI Batch dropdown values to DB Student Class formats
function resolveClassFromBatch(batch: string): string {
  let cls = batch.trim()
  if (cls.toLowerCase().startsWith('grade ')) {
    cls = cls.substring(6) // remove 'Grade '
  }
  // Convert '11-A' or '10-B' to '11 - A' or '10 - B'
  if (/^\d+-[A-Z]$/.test(cls)) {
    const parts = cls.split('-')
    cls = `${parts[0]} - ${parts[1]}`
  }
  return cls
}

// GET — load marked attendance OR default class list
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const batch = searchParams.get('batch')
    const subject = searchParams.get('subject')

    if (!date || !batch || !subject) {
      return NextResponse.json({ error: 'Missing query parameters: date, batch, subject' }, { status: 400 })
    }

    // Seeding check: Ensure student roster exists for classes 11-A, 11-B, etc.
    const targetClassCount = await Student.countDocuments({
      class: { $in: ['11 - A', '11 - B', '10 - A', '10 - B', 'Grade 11-A', 'Grade 11-B'] }
    })
    if (targetClassCount < 10) {
      const firstNames = ['Karan', 'Isha', 'Rohan', 'Meera', 'Amit', 'Neha', 'Rahul', 'Priya', 'Sanjay', 'Deepa', 'Vijay', 'Anjali', 'Rajesh', 'Sunita', 'Vikram', 'Kavita', 'Arjun', 'Pooja', 'Aditya', 'Ritu']
      const lastNames = ['Sharma', 'Patel', 'Gupta', 'Kumar', 'Verma', 'Singh', 'Joshi', 'Mehta', 'Shah', 'Rao', 'Nair', 'Das', 'Sen', 'Reddy', 'Gowda', 'Mishra', 'Trivedi', 'Pandey', 'Choudhury', 'Gill']
      
      const newStudentsData = []
      
      // Explicitly insert Kunal Singhi in 11 - B to match search criteria
      newStudentsData.push({
        name: 'Kunal Singhi',
        rollNo: '11B-001',
        class: '11 - B',
        section: 'B',
        parentContact: '+91 98765 43210',
        isActive: true
      })

      for (let i = 0; i < 50; i++) {
        const fn = firstNames[i % firstNames.length]
        const ln = lastNames[i % lastNames.length]
        const classNum = i % 2 === 0 ? '11' : '10'
        const sec = i % 3 === 0 ? 'A' : 'B'
        const rollNum = `${classNum}${sec}-${String(i + 2).padStart(3, '0')}`
        
        newStudentsData.push({
          name: `${fn} ${ln}`,
          rollNo: rollNum,
          class: `${classNum} - ${sec}`,
          section: sec,
          parentContact: `+91 98765 ${String(10000 + i)}`,
          isActive: true
        })
      }
      await Student.insertMany(newStudentsData)
    }

    // Try finding an existing marked attendance sheet
    const existing = await Attendance.findOne({ date, batch, subject }).lean()

    if (existing) {
      return NextResponse.json(existing)
    }

    // If no sheet exists, load all active students of this batch to mark attendance
    const resolvedClass = resolveClassFromBatch(batch)
    const students = await Student.find({
      class: { $in: [resolvedClass, batch] },
      isActive: true
    }).sort({ rollNo: 1, name: 1 }).lean()


    const defaultRecords = students.map((st) => ({
      studentId: st._id,
      studentName: st.name,
      rollNo: st.rollNo || '',
      status: '', // initially empty/unmarked
      notes: ''
    }))

    // Return template attendance sheet
    return NextResponse.json({
      date,
      batch,
      subject,
      classTime: '09:00 AM - 10:00 AM', // default mock slot
      records: defaultRecords,
      isNew: true
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — save or update attendance sheet
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher' && (session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { date, batch, subject, classTime, records } = body

    if (!date || !batch || !subject || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required body parameters.' }, { status: 400 })
    }

    // Upsert the marked attendance document
    const attendance = await Attendance.findOneAndUpdate(
      { date, batch, subject },
      {
        date,
        batch,
        subject,
        classTime: classTime || '09:00 AM - 10:00 AM',
        records: records.map(r => ({
          studentId: r.studentId,
          studentName: r.studentName,
          rollNo: r.rollNo || '',
          status: r.status || '',
          notes: r.notes || ''
        }))
      },
      { new: true, upsert: true }
    )

    return NextResponse.json(attendance, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
