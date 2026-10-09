// Pure helpers for the student bulk import (no DB access, unit-tested):
// merging a CSV row into an existing student, and per-row validation.

export const STUDENT_OPTIONAL_FIELDS = [
  'admissionNumber', 'aadharNumber',
  'email', 'phone', 'addressLine1', 'city', 'state', 'pincode',
  'dob', 'gender', 'bloodGroup', 'profileImgUrl',
  'previousSchool', 'previousPercentage', 'admissionDate', 'notes',
] as const
export type StudentOptionalField = (typeof STUDENT_OPTIONAL_FIELDS)[number]

/** varchar limits of the students table (lib/db/schema.ts); text columns omitted. */
export const STUDENT_FIELD_LIMITS: Record<string, number> = {
  name: 255, rollNo: 255, class: 255, section: 255, program: 255, batch: 255,
  parentContact: 255, status: 20,
  admissionNumber: 100, aadharNumber: 20, email: 255, phone: 50, addressLine1: 500,
  city: 100, state: 100, pincode: 20, dob: 10, gender: 20, bloodGroup: 10,
  previousSchool: 255, previousPercentage: 20, admissionDate: 10,
}

/** Stored values the merge can fall back on. */
export interface StoredStudent {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  batchId: string | null
  parentContact: string | null
  status: string
  isActive: boolean
  [field: string]: unknown
}

/** Cells of one CSV row; '' / undefined = the cell was absent or empty. */
export interface StudentCells {
  name: string
  rollNo?: string
  class?: string
  section?: string
  program?: string
  batch?: string
  /** resolved id of `batch` (only meaningful when batch is given) */
  batchId?: string | null
  parentContact?: string
  status?: string
  optional?: Partial<Record<StudentOptionalField, string>>
}

export interface MergedStudent {
  name: string
  rollNo: string
  class: string
  section: string
  program: string
  batch: string
  batchId: string | null
  parentContact: string | null
  status: string
  isActive: boolean
  optional: Partial<Record<StudentOptionalField, string | null>>
}

const given = (v: string | undefined | null): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * Absent/empty cells never overwrite stored values (same rule as the faculty
 * import). Active status changes only when the row has an explicit Status
 * cell: a re-import never silently reactivates an inactive student.
 */
export function mergeStudentRow(existing: StoredStudent | null, cells: StudentCells): MergedStudent {
  const pick = (cell: string | undefined, stored: string | null | undefined, fallback: string) =>
    given(cell) ? cell.trim() : (stored ?? fallback)

  const status = given(cells.status) ? cells.status.trim() : (existing?.status ?? 'active')
  const isActive = given(cells.status)
    ? cells.status.trim().toLowerCase() !== 'inactive'
    : (existing ? existing.isActive : true)

  const optional: MergedStudent['optional'] = {}
  for (const f of STUDENT_OPTIONAL_FIELDS) {
    const cell = cells.optional?.[f]
    optional[f] = given(cell) ? cell.trim() : ((existing?.[f] as string | null | undefined) ?? null)
  }

  return {
    name: cells.name.trim(),
    rollNo: pick(cells.rollNo, existing?.rollNo, ''),
    class: pick(cells.class, existing?.class, ''),
    section: pick(cells.section, existing?.section, ''),
    program: pick(cells.program, existing?.program, ''),
    batch: pick(cells.batch, existing?.batch, ''),
    batchId: given(cells.batch) ? (cells.batchId ?? null) : (existing?.batchId ?? null),
    parentContact: given(cells.parentContact) ? cells.parentContact.trim() : (existing ? existing.parentContact : ''),
    status,
    isActive,
    optional,
  }
}

/** First value that does not fit its column, or null. */
export function findTooLongField(values: Record<string, unknown>): { field: string; limit: number } | null {
  for (const [field, limit] of Object.entries(STUDENT_FIELD_LIMITS)) {
    const v = values[field]
    if (typeof v === 'string' && v.length > limit) return { field, limit }
  }
  return null
}

export const rollKey = (s: { rollNo: string; class: string; section: string }) =>
  s.rollNo && s.class ? `${s.rollNo}|${s.class}|${s.section}` : null

/**
 * Rows whose final (roll no, class, section) would collide with a different
 * existing student, or with another row of the same import. Returns
 * index -> reason; those rows are reported and skipped instead of failing
 * the whole chunk on the unique index.
 */
export function findRollKeyConflicts(
  rows: Array<{ index: number; id: string; rollNo: string; class: string; section: string }>,
  existing: Array<{ id: string; rollNo: string; class: string; section: string }>,
): Map<number, string> {
  const owner = new Map<string, string>()
  for (const s of existing) {
    const k = rollKey(s)
    if (k) owner.set(k, s.id)
  }
  // Keys vacated by rows that move a student elsewhere are not freed up front:
  // swapping roll numbers inside one import is reported, not guessed at.
  const conflicts = new Map<number, string>()
  const claimed = new Map<string, string>()
  for (const r of rows) {
    const k = rollKey(r)
    if (!k) continue
    const holder = owner.get(k)
    if (holder && holder !== r.id) {
      conflicts.set(r.index, `Another student already has roll number ${r.rollNo} in class ${r.class}${r.section ? ` section ${r.section}` : ''}.`)
      continue
    }
    const other = claimed.get(k)
    if (other && other !== r.id) {
      conflicts.set(r.index, `Another row in this file uses roll number ${r.rollNo} in class ${r.class}${r.section ? ` section ${r.section}` : ''}.`)
      continue
    }
    claimed.set(k, r.id)
  }
  return conflicts
}
