export const NEXT_CLASS: Record<string, string> = { '9': '10', '10': '11', '11': '12' }

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function computeBoundaryDate(academicYearStartMonth: number, today: Date = new Date()): string {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1 // 1-12
  const boundaryYear = month >= academicYearStartMonth ? year : year - 1
  return `${boundaryYear}-${pad2(academicYearStartMonth)}-01`
}

export function subtractOneYear(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y - 1}-${pad2(m)}-${pad2(d)}`
}

export function computeAcademicYearLabel(boundaryDate: string): string {
  const [y] = boundaryDate.split('-').map(Number)
  return `${y}-${y + 1}`
}

export interface PromotionCandidate {
  class: string
  admissionDate: string | null
  isActive: boolean
}

// A student with no recorded admissionDate is treated as admitted before the
// boundary (eligible), not permanently excluded — most pre-existing student
// rows predate this feature and have no reliable admission date on file.
export function isEligibleForPromotion(student: PromotionCandidate, previousBoundaryDate: string): boolean {
  if (!student.isActive) return false
  if (!(student.class in NEXT_CLASS)) return false
  if (!student.admissionDate) return true
  return student.admissionDate < previousBoundaryDate
}

export interface PreviewCounts {
  [fromClass: string]: { [toClass: string]: number }
}

export function buildPreviewCounts(eligibleStudents: { class: string }[]): PreviewCounts {
  const counts: PreviewCounts = {}
  for (const s of eligibleStudents) {
    const next = NEXT_CLASS[s.class]
    if (!next) continue
    counts[s.class] = counts[s.class] || {}
    counts[s.class][next] = (counts[s.class][next] || 0) + 1
  }
  return counts
}
