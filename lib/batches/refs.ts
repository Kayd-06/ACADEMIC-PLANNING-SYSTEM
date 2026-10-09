// Pure checks for the foreign ids a batch can point at (no DB access, unit-tested).
import { isUuid } from '@/lib/tenant'

export const BATCH_REF_FIELDS = ['teacherId', 'programId'] as const
export type BatchRefField = (typeof BATCH_REF_FIELDS)[number]

const LABEL: Record<BatchRefField, string> = { teacherId: 'Coordinator', programId: 'Program' }

/** Ids actually set by the request (null/'' clears the link and is always allowed). */
export function requestedRefs(data: Partial<Record<BatchRefField, unknown>>): Partial<Record<BatchRefField, string>> {
  const out: Partial<Record<BatchRefField, string>> = {}
  for (const f of BATCH_REF_FIELDS) {
    const v = data[f]
    if (v !== undefined && v !== null && v !== '') out[f] = String(v)
  }
  return out
}

/** 400 message for an id that is not a UUID, or null. */
export function malformedRef(refs: Partial<Record<BatchRefField, string>>): string | null {
  for (const f of BATCH_REF_FIELDS) {
    const v = refs[f]
    if (v !== undefined && !isUuid(v)) return `${LABEL[f]} id is not valid.`
  }
  return null
}

/**
 * 400 message for an id that does not belong to the caller's school, or null.
 * `inSchool` holds the ids found by school-scoped lookups.
 */
export function foreignRef(
  refs: Partial<Record<BatchRefField, string>>,
  inSchool: Partial<Record<BatchRefField, ReadonlySet<string>>>,
): string | null {
  for (const f of BATCH_REF_FIELDS) {
    const v = refs[f]
    if (v !== undefined && !inSchool[f]?.has(v)) return `${LABEL[f]} was not found in your school.`
  }
  return null
}
