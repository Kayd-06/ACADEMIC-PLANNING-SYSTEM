import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminSchools } from '@/lib/db/schema'
import { HttpError } from '@/lib/api/http'
import { requireSchool } from '@/lib/tenant'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Schools the signed-in user may act on: always the active school, plus —
 * for management — every school they are a linked admin of (admin_schools).
 * Teachers only ever get their active school.
 */
export async function accessibleSchoolIds(session: any): Promise<string[]> {
  const active = requireSchool(session)
  if (session?.user?.role !== 'management' || !session?.user?.id) return [active]
  const rows = await db.select({ schoolId: adminSchools.schoolId }).from(adminSchools)
    .where(eq(adminSchools.userId, session.user.id))
  return [...new Set([active, ...rows.map(r => r.schoolId)])]
}

/**
 * Resolve a school the client asked for (query param or body field) against
 * what the user may access. Empty / 'ALL' / 'null' / missing -> the active
 * school (records are never created as "visible to every school" anymore).
 * Anything else must be a school the user administers, or it's a 403.
 */
export async function resolveRequestedSchool(session: any, requested: unknown): Promise<string> {
  const active = requireSchool(session)
  if (typeof requested !== 'string' || !requested || requested === 'ALL' || requested === 'null' || requested === active) {
    return active
  }
  if (!UUID_RE.test(requested)) throw new HttpError(400, 'Invalid school id.')
  const allowed = await accessibleSchoolIds(session)
  if (!allowed.includes(requested)) throw new HttpError(403, 'You do not have access to that school.')
  return requested
}

