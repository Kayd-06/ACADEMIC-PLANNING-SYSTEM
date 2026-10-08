import { auth } from '@/lib/auth'
import { HttpError } from '@/lib/api/http'
import { accessibleSchoolIds } from '@/lib/tenantAccess'
import { logAuditAction } from '@/lib/audit'
import { runAfterResponse } from '@/lib/sideEffects'

/**
 * Every recruitment route requires a signed-in management user with an
 * active school. `schoolIds` = the active school plus any other school this
 * admin is linked to (admin_schools); reads and writes are limited to them.
 */
export async function requireRecruitmentAccess() {
  const session = await auth()
  if (!session) throw new HttpError(401, 'Unauthorized')
  if ((session.user as any)?.role !== 'management') {
    throw new HttpError(403, 'Only management can access recruitment')
  }
  const schoolIds = await accessibleSchoolIds(session)
  return { session, activeSchoolId: schoolIds[0], schoolIds }
}

interface AuditEntry {
  userActionType: string
  tableName: string
  recordId: string
  oldValues?: unknown
  newValues?: unknown
  schoolId: string | null
}

/** Write an audit-log row after the response (never blocks or fails the request). */
export function auditAfterResponse(session: any, req: Request, entry: AuditEntry) {
  // Capture request-derived values now; the task runs after the response.
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1'
  const userAgent = req.headers.get('user-agent') || 'Unknown'
  const authorName = session?.user?.name || 'Admin'
  const authorRole = session?.user?.role || 'Management'
  runAfterResponse(`audit:${entry.userActionType}`, () => logAuditAction({
    ...entry,
    ipAddress,
    userAgent,
    authorName,
    authorRole,
  }))
}
