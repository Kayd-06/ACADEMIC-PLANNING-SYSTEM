import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { parentsGuardians, programs, batches } from '@/lib/db/schema'
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

interface FieldError {
  row: string
  field: 'program' | 'batch' | 'general'
  value: string
  message: string
}

class ValidationError extends Error {
  field: 'program' | 'batch'
  value: string
  constructor(field: 'program' | 'batch', value: string, message: string) {
    super(message)
    this.field = field
    this.value = value
  }
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

    // Program/Batch must match a real, school-scoped record — CSV values and
    // modal defaults are free text with no other guarantee of correctness.
    const schoolPrograms = schoolId
      ? await db.select().from(programs).where(eq(programs.schoolId, schoolId))
      : await db.select().from(programs)
    const schoolBatches = schoolId
      ? await db.select().from(batches).where(eq(batches.schoolId, schoolId))
      : await db.select().from(batches)
    const programByName = new Map(schoolPrograms.map((p) => [p.name.trim().toLowerCase(), p]))
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))

    const rowLabels = valid.map((s: any) => {
      const name = s.name.trim()
      const rollNo = s.rollNo?.trim()
      return rollNo ? `${name} (Roll ${rollNo})` : name
    })

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

        let matchedProgram: typeof schoolPrograms[number] | undefined
        if (program) {
          matchedProgram = programByName.get(program.toLowerCase())
          if (!matchedProgram) {
            throw new ValidationError('program', program, `Program "${program}" does not exist. Create it first in Academic Planning, or fix the spelling.`)
          }
        }
        if (batch) {
          const matchedBatch = batchByName.get(batch.toLowerCase())
          if (!matchedBatch) {
            throw new ValidationError('batch', batch, `Batch "${batch}" does not exist. Create it first in Academic Planning, or fix the spelling.`)
          }
          if (matchedProgram && matchedBatch.programId !== matchedProgram.id) {
            throw new ValidationError('batch', batch, `Batch "${batch}" exists but belongs to a different Program, not "${program}".`)
          }
        }

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
    const errors: FieldError[] = []
    results.forEach((r, i) => {
      if (r.status !== 'rejected') return
      const reason = r.reason
      if (reason instanceof ValidationError) {
        errors.push({ row: rowLabels[i], field: reason.field, value: reason.value, message: reason.message })
      } else {
        errors.push({ row: rowLabels[i], field: 'general', value: '', message: reason?.message || String(reason) })
      }
    })
    const failed = errors.length

    if (failed > 0) {
      console.error('Bulk import failures:', errors)
    }

    return NextResponse.json({ succeeded, failed, total: valid.length, errors }, { status: 201 })
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
