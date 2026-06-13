import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Student from '@/models/Student'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { students } = body

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Only name is required; all other fields are optional
    const valid = students.filter(s => s.name?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      valid.map(s => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = s.section?.trim() || ''
        const parentContact = s.parentContact?.trim() || ''

        // If rollNo + class + section all present → upsert (prevents duplicates)
        // Otherwise → plain insert (name-only rows are always added)
        if (rollNo && cls && section) {
          return Student.findOneAndUpdate(
            { rollNo, class: cls, section },
            { name, rollNo, class: cls, section, parentContact, isActive: true },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
        } else {
          return Student.create({ name, rollNo, class: cls, section, parentContact, isActive: true })
        }
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failedResults = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    const failed = failedResults.length
    const failedReasons = failedResults.map(r => r.reason?.message || r.reason)

    if (failed > 0) {
      console.error('Bulk import failures:', failedReasons)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, failedReasons }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
