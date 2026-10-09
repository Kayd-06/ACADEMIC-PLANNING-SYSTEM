// Pure helpers for the fee payments bulk import (no DB access, unit-tested).
import { createHash } from 'crypto'

export interface FeeImportStudent {
  id: string
  name: string
  rollNo: string | null
  class: string | null
  section: string | null
  admissionNumber: string | null
}

export interface FeeImportStudentCells {
  admissionNumber?: string
  rollNo?: string
  class?: string
  section?: string
  name?: string
}

export type FeeStudentMatch<S> =
  | { kind: 'matched'; student: S }
  | { kind: 'unmatched' }
  | { kind: 'ambiguous'; message: string }

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()

function group<S>(items: S[], key: (s: S) => string | null): Map<string, S[]> {
  const m = new Map<string, S[]>()
  for (const s of items) {
    const k = key(s)
    if (k) m.set(k, [...(m.get(k) ?? []), s])
  }
  return m
}

/**
 * Roll numbers are only unique per class + section, so a bare roll number
 * must never silently pick "the first" student of the school. Priority:
 *   1. admission number
 *   2. roll no + class (+ section when given)
 *   3. roll no alone, only when exactly one student in the school has it
 *   4. name, only when exactly one student has it
 * Several candidates at any step = an error for that row (never a guess).
 */
export function buildFeeStudentMatcher<S extends FeeImportStudent>(students: S[]) {
  const byAdmission = group(students, s => norm(s.admissionNumber) || null)
  const byRoll = group(students, s => norm(s.rollNo) || null)
  const byName = group(students, s => norm(s.name) || null)

  return (cells: FeeImportStudentCells): FeeStudentMatch<S> => {
    const adm = norm(cells.admissionNumber)
    const roll = norm(cells.rollNo)
    const cls = norm(cells.class)
    const section = norm(cells.section)
    const name = norm(cells.name)

    if (adm) {
      const c = byAdmission.get(adm) ?? []
      if (c.length === 1) return { kind: 'matched', student: c[0] }
      if (c.length > 1) return { kind: 'ambiguous', message: `Admission Number ${cells.admissionNumber} belongs to several students` }
    }
    if (roll) {
      let c = byRoll.get(roll) ?? []
      if (cls) {
        c = c.filter(s => norm(s.class) === cls && (!section || norm(s.section) === section))
        if (c.length === 1) return { kind: 'matched', student: c[0] }
        if (c.length > 1) return { kind: 'ambiguous', message: `Roll No ${cells.rollNo} in class ${cells.class} matches several students; add a Section or Admission Number column` }
      } else {
        if (c.length === 1) return { kind: 'matched', student: c[0] }
        if (c.length > 1) return { kind: 'ambiguous', message: `Roll No ${cells.rollNo} exists in several classes; add Class and Section columns or an Admission Number column` }
      }
    }
    if (name) {
      const c = byName.get(name) ?? []
      if (c.length === 1) return { kind: 'matched', student: c[0] }
      if (c.length > 1) return { kind: 'ambiguous', message: `Several students are named "${cells.name}"; add Roll No + Class or an Admission Number column` }
    }
    return { kind: 'unmatched' }
  }
}

export interface ReceiptKeyParts {
  schoolId: string
  /** matched student id, or the row's name/roll when unmatched */
  student: string
  /** fee structure id, or the fee name when no structure matched */
  fee: string
  /** the raw cells (not defaulted to "today") so the key is stable across days */
  dueDate: string
  paidDate: string
  amountDue: number
  amountPaid: number
}

/**
 * Deterministic receipt number for rows without one. Re-importing the same
 * sheet maps each row to the same receipt and updates it instead of creating
 * a duplicate payment; `occurrence` (the n-th identical row in the file)
 * keeps genuinely repeated payments in one sheet distinct.
 */
export function importReceiptNumber(parts: ReceiptKeyParts, occurrence: number): string {
  const key = [
    parts.schoolId, norm(parts.student), norm(parts.fee), parts.dueDate.trim(), parts.paidDate.trim(),
    String(parts.amountDue), String(parts.amountPaid), String(occurrence),
  ].join('\u001f')
  return `IMP-${createHash('sha256').update(key).digest('hex').slice(0, 24).toUpperCase()}`
}

/** Tracks how many identical rows were seen so far (0 for the first). */
export function occurrenceCounter() {
  const seen = new Map<string, number>()
  return (parts: ReceiptKeyParts) => {
    const k = importReceiptNumber(parts, 0)
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1)
    return n
  }
}
