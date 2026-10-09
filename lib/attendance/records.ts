import { isUuid } from '@/lib/tenant'

// Pure validation for POST /api/attendance records (unit-tested, no DB).

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const

export interface AttendanceRecordInput {
  studentId?: unknown
  studentName?: unknown
  rollNo?: unknown
  status?: unknown
  notes?: unknown
}

export interface CleanAttendanceRecord {
  studentId: string | null
  studentName: string
  rollNo: string
  status: string
  notes: string
}

export type RecordsResult =
  | { ok: true; records: CleanAttendanceRecord[]; studentIds: string[] }
  | { ok: false; error: string }

/**
 * Validates and normalises the records of one attendance sheet:
 *  - studentName required (max 255), rollNo max 100, notes max 500
 *  - status one of ATTENDANCE_STATUSES (default Absent)
 *  - studentId optional, but when present it must be a UUID
 *  - the same student twice keeps the last occurrence (what the teacher saw last)
 * Whether the student ids exist in the caller's school is checked separately
 * (that needs the database).
 */
export function validateAttendanceRecords(input: unknown): RecordsResult {
  if (!Array.isArray(input)) return { ok: false, error: 'records must be an array.' }
  if (input.length > 2000) return { ok: false, error: 'Too many records in one sheet (max 2000).' }

  const byStudent = new Map<string, CleanAttendanceRecord>()
  const anonymous: CleanAttendanceRecord[] = []
  for (let i = 0; i < input.length; i++) {
    const r = input[i] as AttendanceRecordInput
    const at = `Record ${i + 1}`
    if (!r || typeof r !== 'object') return { ok: false, error: `${at} is invalid.` }
    if (typeof r.studentName !== 'string' || !r.studentName.trim()) {
      return { ok: false, error: 'Every record needs a studentName.' }
    }
    const studentName = r.studentName.trim()
    if (studentName.length > 255) return { ok: false, error: `${at}: studentName is too long.` }

    const status = r.status === undefined || r.status === null || r.status === '' ? 'Absent' : r.status
    if (typeof status !== 'string' || !(ATTENDANCE_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, error: `Invalid status "${String(r.status)}" — must be one of: ${ATTENDANCE_STATUSES.join(', ')}` }
    }

    const rollNo = r.rollNo === undefined || r.rollNo === null ? '' : String(r.rollNo).trim()
    if (rollNo.length > 100) return { ok: false, error: `${at}: rollNo is too long.` }
    const notes = r.notes === undefined || r.notes === null ? '' : String(r.notes)
    if (notes.length > 500) return { ok: false, error: `${at}: notes are too long (max 500 characters).` }

    let studentId: string | null = null
    if (r.studentId !== undefined && r.studentId !== null && r.studentId !== '') {
      if (!isUuid(r.studentId)) return { ok: false, error: `${at}: studentId is not a valid id.` }
      studentId = r.studentId.toLowerCase()
    }

    const clean = { studentId, studentName, rollNo, status, notes }
    if (studentId) {
      byStudent.delete(studentId) // keep insertion order of the last occurrence
      byStudent.set(studentId, clean)
    } else {
      anonymous.push(clean)
    }
  }
  return { ok: true, records: [...byStudent.values(), ...anonymous], studentIds: [...byStudent.keys()] }
}

/** Ids from the sheet that are not students of the caller's school. */
export function unknownStudentIds(requested: string[], foundInSchool: Iterable<string>): string[] {
  const found = new Set([...foundInSchool].map((id) => id.toLowerCase()))
  return requested.filter((id) => !found.has(id))
}
