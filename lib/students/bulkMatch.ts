// Pure matching logic for the student bulk import (no DB access, unit-tested).

export interface ExistingStudentKey {
  id: string
  rollNo: string
  class: string
  section: string
  admissionNumber: string | null
  name: string
}

export interface IncomingStudentKey {
  name: string
  rollNo: string
  class: string
  section: string
  /** false when the CSV row (and defaults) had no section at all */
  sectionProvided: boolean
  admissionNumber?: string | null
}

export interface MatchResult {
  /** id of the existing student this row updates, or null for a new student */
  existingId: string | null
  /** section to store: the row's section, or the matched student's when the row had none */
  section: string
  /**
   * Identity of the row within this import, used to collapse duplicate rows
   * in the same file (last one wins). null = never deduplicated (name-only rows).
   */
  dedupeKey: string | null
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Match priority (same as before, but section-aware and against one prefetch
 * instead of one query per row):
 *   1. roll no + class (+ section when the row has one)
 *   2. admission number
 *   3. name + class (+ section when the row has one)
 *   4. otherwise a new student (name-only rows are always added fresh)
 */
export function buildStudentMatcher(existing: ExistingStudentKey[]) {
  const byRollClass = new Map<string, ExistingStudentKey[]>()
  const byAdmission = new Map<string, ExistingStudentKey>()
  const byNameClass = new Map<string, ExistingStudentKey[]>()
  for (const s of existing) {
    if (s.rollNo && s.class) {
      const k = `${s.rollNo}|${s.class}`
      byRollClass.set(k, [...(byRollClass.get(k) ?? []), s])
    }
    if (s.admissionNumber && !byAdmission.has(s.admissionNumber)) byAdmission.set(s.admissionNumber, s)
    if (s.class) {
      const k = `${norm(s.name)}|${s.class}`
      byNameClass.set(k, [...(byNameClass.get(k) ?? []), s])
    }
  }

  const pick = (candidates: ExistingStudentKey[] | undefined, row: IncomingStudentKey) => {
    if (!candidates || candidates.length === 0) return undefined
    if (row.sectionProvided) return candidates.find(c => c.section === row.section)
    // No section in the file: prefer the student with no section, otherwise
    // the only candidate. Several sectioned candidates = ambiguous -> new row.
    return candidates.find(c => c.section === '') ?? (candidates.length === 1 ? candidates[0] : undefined)
  }

  return (row: IncomingStudentKey): MatchResult => {
    let match: ExistingStudentKey | undefined
    let dedupeKey: string | null = null
    if (row.rollNo && row.class) {
      match = pick(byRollClass.get(`${row.rollNo}|${row.class}`), row)
      dedupeKey = `rc:${row.rollNo}|${row.class}|${match ? match.section : row.section}`
    } else if (row.admissionNumber) {
      match = byAdmission.get(row.admissionNumber)
      dedupeKey = `adm:${row.admissionNumber}`
    } else if (row.class) {
      match = pick(byNameClass.get(`${norm(row.name)}|${row.class}`), row)
      dedupeKey = `nc:${norm(row.name)}|${row.class}|${match ? match.section : row.section}`
    }
    if (match) {
      return {
        existingId: match.id,
        section: row.sectionProvided ? row.section : match.section,
        dedupeKey: `id:${match.id}`,
      }
    }
    return { existingId: null, section: row.section, dedupeKey }
  }
}
