import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty, teacherBatches, batches, type NewFaculty, type Faculty } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface FieldError {
  row: string
  field: 'name' | 'subject' | 'specialization' | 'batches' | 'general'
  value: string
  message: string
}

class ValidationError extends Error {
  field: 'name' | 'subject' | 'specialization'
  value: string
  constructor(field: 'name' | 'subject' | 'specialization', value: string, message: string) {
    super(message)
    this.field = field
    this.value = value
  }
}

// Every faculty field the manual "Add Faculty" form and CSV template support,
// excluding name/subject/specialization (required, handled separately) and
// batches (a comma-separated names cell here, not the legacy count column).
const FACULTY_ROW_FIELDS = [
  'employeeId', 'email', 'phone', 'altPhone', 'dob', 'gender',
  'addressLine1', 'city', 'state', 'pincode',
  'qualification', 'primaryStream', 'joiningDate', 'bio', 'profileImgUrl',
] as const

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can import faculty' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { faculty: rows } = body as { faculty: any[] }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No faculty data provided' }, { status: 400 })
    }

    // Batch names must match a real, school-scoped record — same convention
    // as Program/Batch validation for students.
    const schoolBatches = schoolId
      ? await db.select().from(batches).where(eq(batches.schoolId, schoolId))
      : await db.select().from(batches)
    const batchByName = new Map(schoolBatches.map((b) => [b.name.trim().toLowerCase(), b]))

    const rowLabels = rows.map((r: any, i: number) => r.name?.trim() || `Row ${i + 1}`)
    const batchErrors: (FieldError | null)[] = rows.map(() => null)

    const results = await Promise.allSettled(
      rows.map(async (r: any, i: number) => {
        const name = r.name?.trim() || ''
        const subject = r.subject?.trim() || ''
        const specialization = r.specialization?.trim() || ''
        if (!name) throw new ValidationError('name', '', 'Name is required')
        if (!subject) throw new ValidationError('subject', '', 'Subject is required')
        if (!specialization) throw new ValidationError('specialization', '', 'Specialization is required')

        const employeeId = r.employeeId?.trim() || ''
        const email = r.email?.trim() || ''

        // Batch validation is non-blocking: bad names are reported but the
        // row (and any valid batch names in the same cell) still saves.
        const requestedBatchNames = (r.batches?.trim() || '')
          .split(',')
          .map((b: string) => b.trim())
          .filter(Boolean)
        const validBatches: typeof schoolBatches = []
        const invalidBatchNames: string[] = []
        for (const bn of requestedBatchNames) {
          const match = batchByName.get(bn.toLowerCase())
          if (match) validBatches.push(match)
          else invalidBatchNames.push(bn)
        }
        if (invalidBatchNames.length > 0) {
          batchErrors[i] = {
            row: rowLabels[i],
            field: 'batches',
            value: invalidBatchNames.join(', '),
            message: `Batch(es) not found: ${invalidBatchNames.join(', ')}. Create them first in Academic Planning, or fix the spelling.`,
          }
        }

        const data: Record<string, any> = { name, subject, specialization }
        for (const f of FACULTY_ROW_FIELDS) {
          const v = r[f]
          if (typeof v === 'string' && v.trim()) data[f] = v.trim()
        }
        const statusValue = r.status?.trim() || ''
        if (statusValue) {
          data.status = statusValue.toUpperCase()
          data.isActive = statusValue.toUpperCase() !== 'INACTIVE'
        }
        const experienceYearsValue = r.experienceYears?.trim() || ''
        if (experienceYearsValue) {
          data.experienceYears = Number(experienceYearsValue) || null
          data.experience = `${data.experienceYears} years`
        }

        // Match on the most reliable key available: Employee ID, then Email.
        // Neither present → always insert new.
        let existing: Faculty | undefined
        if (employeeId) {
          const cond = schoolId ? and(eq(faculty.employeeId, employeeId), eq(faculty.schoolId, schoolId)) : eq(faculty.employeeId, employeeId)
          const matches = await db.select().from(faculty).where(cond)
          existing = matches[0]
        } else if (email) {
          const cond = schoolId ? and(eq(faculty.email, email), eq(faculty.schoolId, schoolId)) : eq(faculty.email, email)
          const matches = await db.select().from(faculty).where(cond)
          existing = matches[0]
        }

        let teacherId: string
        if (existing) {
          const [updated] = await db.update(faculty)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(faculty.id, existing.id))
            .returning()
          teacherId = updated.id
        } else {
          try {
            const [created] = await db.insert(faculty).values({
              ...(data as NewFaculty),
              schoolId,
            }).returning()
            teacherId = created.id
          } catch (error: any) {
            // Two rows in this file shared an Employee ID and raced — the
            // first insert already created the row; apply this row as an update.
            if ((error.code === '23505' || error.cause?.code === '23505') && employeeId) {
              const cond = schoolId ? and(eq(faculty.employeeId, employeeId), eq(faculty.schoolId, schoolId)) : eq(faculty.employeeId, employeeId)
              const retryMatches = await db.select().from(faculty).where(cond)
              const retried = retryMatches[0]
              if (!retried) throw error
              const [updated] = await db.update(faculty)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(faculty.id, retried.id))
                .returning()
              teacherId = updated.id
            } else {
              throw error
            }
          }
        }

        // Add-only batch assignment: never remove an assignment this sheet
        // doesn't mention, never duplicate one it does.
        if (validBatches.length > 0) {
          const existingAssignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, teacherId))
          const existingNames = new Set(existingAssignments.map((a) => a.batchName.trim().toLowerCase()))
          for (const b of validBatches) {
            if (!existingNames.has(b.name.trim().toLowerCase())) {
              await db.insert(teacherBatches).values({
                teacherId,
                batchName: b.name,
                subjectName: subject,
                role: 'primary',
                assignedAt: new Date().toISOString().split('T')[0],
              })
              existingNames.add(b.name.trim().toLowerCase())
            }
          }
        }

        // Legacy count column must reflect the real current total, not just
        // this row's new names, so it stays correct across repeated imports.
        const totalAssignments = await db.select().from(teacherBatches).where(eq(teacherBatches.teacherId, teacherId))
        await db.update(faculty).set({ batches: totalAssignments.length }).where(eq(faculty.id, teacherId))

        return teacherId
      })
    )

    const errors: FieldError[] = []
    results.forEach((r, i) => {
      if (batchErrors[i]) errors.push(batchErrors[i]!)
      if (r.status !== 'rejected') return
      const reason = r.reason
      if (reason instanceof ValidationError) {
        errors.push({ row: rowLabels[i], field: reason.field, value: reason.value, message: reason.message })
      } else {
        errors.push({ row: rowLabels[i], field: 'general', value: '', message: reason?.message || String(reason) })
      }
    })
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (failed > 0) {
      console.error('Faculty bulk import failures:', errors)
    }

    return NextResponse.json({ succeeded, failed, total: rows.length, errors }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
