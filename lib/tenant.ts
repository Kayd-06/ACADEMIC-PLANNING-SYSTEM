import { eq, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { HttpError } from '@/lib/api/http'

// NOTE: intentionally does not import from '@/lib/auth' — route tests mock that
// module with only `{ auth }`, and this helper must keep working under mocks.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const NO_SCHOOL_MESSAGE = 'Your account is not linked to a school yet. Select or join a school first.'

/** The active school id from the session, or null when missing/invalid. */
export function sessionSchoolId(session: unknown): string | null {
  const schoolId = (session as { user?: { schoolId?: unknown } } | null | undefined)?.user?.schoolId
  if (typeof schoolId !== 'string' || !UUID_RE.test(schoolId)) return null
  return schoolId
}

/**
 * The active school id from the session. Throws a 403 HttpError when the user
 * has no school — a missing school must never be treated as "no filter".
 */
export function requireSchool(session: unknown): string {
  const schoolId = sessionSchoolId(session)
  if (!schoolId) throw new HttpError(403, NO_SCHOOL_MESSAGE)
  return schoolId
}

/**
 * WHERE fragment that scopes a query to one school. When the school id is
 * missing it matches NOTHING (instead of everything), so a forgotten check can
 * never leak or modify another school's rows.
 */
export function schoolScope(column: AnyPgColumn, schoolId: string | null | undefined): SQL {
  if (!schoolId) return sql`false`
  return eq(column, schoolId)
}
