import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Student from '@/models/Student'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST — bulk import students from parsed CSV/Excel rows
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can bulk import students' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { students } = body

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Validate required fields
    const valid = students.filter(s => s.name?.trim() && s.rollNo?.trim() && s.class?.trim() && s.section?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs: Name, Roll No, Class, Section.' }, { status: 400 })
    }

    // Upsert each student — update if roll+class+section match, insert if new
    const results = await Promise.allSettled(
      valid.map(s =>
        Student.findOneAndUpdate(
          { rollNo: s.rollNo.trim(), class: s.class.trim(), section: s.section.trim() },
          {
            name: s.name.trim(),
            rollNo: s.rollNo.trim(),
            class: s.class.trim(),
            section: s.section.trim(),
            parentContact: s.parentContact?.trim() || '',
            isActive: true,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ succeeded, failed, total: valid.length }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
