import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { parentsGuardians } from '@/lib/db/schema'
import {
  upsertStudentByRollClassSection,
  upsertStudentByAdmissionNumber,
  upsertStudentByNameClassSection,
  createStudent,
  deleteAllStudents,
} from '@/lib/db/queries/students'
import type { NewStudent, Student } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

interface BulkDefaults {
  program?: string
  batch?: string
  section?: string
}

function resolveField(rowValue: string, defaultValue?: string): string {
  return defaultValue?.trim() ? defaultValue.trim() : rowValue
}

// Every student field the "Add Student" form and CSV template support
const STUDENT_ROW_FIELDS = [
  'admissionNumber', 'aadharNumber',
  'email', 'phone', 'addressLine1', 'city', 'state', 'pincode',
  'dob', 'gender', 'bloodGroup', 'profileImgUrl',
  'previousSchool', 'previousPercentage', 'admissionDate', 'notes',
] as const

// POST — bulk import students from parsed CSV/Excel rows (management or teacher)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') {
      return NextResponse.json({ error: 'Only staff can import students' }, { status: 403 })
    }

    const schoolId = (session.user as any).schoolId as string | null
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
      valid.map(async (s: any) => {
        const name = s.name.trim()
        const rollNo = s.rollNo?.trim() || ''
        const cls = s.class?.trim() || ''
        const section = resolveField(s.section?.trim() || '', defaults?.section)
        const program = resolveField(s.program?.trim() || '', defaults?.program)
        const batch = resolveField(s.batch?.trim() || '', defaults?.batch)
        const parentContact = s.parentContact?.trim() || ''
        const status = s.status?.trim() || 'active'

        const data: NewStudent = {
          name, rollNo, class: cls, section, program, batch, parentContact,
          status, isActive: status.toLowerCase() !== 'inactive',
          schoolId,
        }
        for (const f of STUDENT_ROW_FIELDS) {
          const v = s[f]
          if (typeof v === 'string' && v.trim()) data[f] = v.trim()
        }

        // Match on the most reliable key available, falling back progressively:
        // rollNo+class+section, then admission number, then name+class+section,
        // then a plain insert (name-only rows are always added fresh).
        let student: Student
        if (rollNo && cls && section) {
          student = await upsertStudentByRollClassSection(data)
        } else if (data.admissionNumber) {
          student = await upsertStudentByAdmissionNumber(data)
        } else if (cls && section) {
          student = await upsertStudentByNameClassSection(data)
        } else {
          student = await createStudent(data)
        }

        const guardianName = s.guardianName?.trim()
        if (guardianName) {
          const guardianData = {
            name: guardianName,
            relationship: s.guardianRelationship?.trim() || 'Parent',
            phone: s.guardianPhone?.trim() || undefined,
            email: s.guardianEmail?.trim() || undefined,
          }
          const [existingPrimary] = await db.select({ id: parentsGuardians.id })
            .from(parentsGuardians)
            .where(and(eq(parentsGuardians.studentId, student.id), eq(parentsGuardians.isPrimary, true)))
          if (existingPrimary) {
            await db.update(parentsGuardians)
              .set({ ...guardianData, updatedAt: new Date() })
              .where(eq(parentsGuardians.id, existingPrimary.id))
          } else {
            await db.insert(parentsGuardians).values({ ...guardianData, studentId: student.id, isPrimary: true })
          }
        }

        return student
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

    const schoolId = (session.user as any).schoolId as string | null
    await deleteAllStudents(schoolId)

    return NextResponse.json({ success: true, message: 'All students deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
