import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { upsertStudentByRollClassSection, createStudent, deleteAllStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

interface BulkDefaults {
  program?: string
  batch?: string
  section?: string
}

function resolveField(rowValue: string, defaultValue?: string): string {
  return defaultValue?.trim() ? defaultValue.trim() : rowValue
}

// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    const body = await req.json()
    const { students, defaults } = body as { students: any[]; defaults?: BulkDefaults }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 })
    }

    // Only name is required; all other fields are optional
    const valid = students.filter((s: any) => s.name?.trim())
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Each row needs at least a Name.' }, { status: 400 })
    }

    const results = await Promise.allSettled(
      valid.map((s: any) => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = resolveField(s.section?.trim() || '', defaults?.section)
        const program = resolveField(s.program?.trim() || '', defaults?.program)
        const batch = resolveField(s.batch?.trim() || '', defaults?.batch)
        const parentContact = s.parentContact?.trim() || ''

        // If rollNo + class + section all present → upsert (prevents duplicates)
        // Otherwise → plain insert (name-only rows are always added)
        if (rollNo && cls && section) {
          return upsertStudentByRollClassSection({ name, rollNo, class: cls, section, program, batch, parentContact, isActive: true })
        } else {
          return createStudent({ name, rollNo, class: cls, section, program, batch, parentContact, isActive: true })
        }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failedResults = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    const failed = failedResults.length
    const failedReasons = failedResults.map((r) => r.reason?.message || r.reason)

    if (failed > 0) {
      console.error('Bulk import failures:', failedReasons)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, failedReasons }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — bulk delete all students (management only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can clear all rosters' }, { status: 403 })
    }

    await deleteAllStudents()

    return NextResponse.json({ success: true, message: 'All students deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
