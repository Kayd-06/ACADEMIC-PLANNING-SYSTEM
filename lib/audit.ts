import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { auth } from '@/lib/auth'

interface AuditParams {
  userActionType: string
  tableName: string
  recordId?: string
  oldValues?: any
  newValues?: any
  req?: Request
  authorName?: string
  authorRole?: string
  /** Explicit school for the log row (preferred over guessing from values). */
  schoolId?: string | null
  ipAddress?: string
  userAgent?: string
}

export async function logAuditAction({
  userActionType,
  tableName,
  recordId = '',
  oldValues = null,
  newValues = null,
  req,
  authorName,
  authorRole,
  schoolId,
  ipAddress: ipOverride,
  userAgent: uaOverride,
}: AuditParams) {
  try {
    let name = authorName
    let role = authorRole

    if (!name || !role) {
      const session = await auth()
      if (session?.user) {
        name = name || session.user.name || 'Admin'
        role = role || session.user.role || 'Management'
      }
    }

    const ipAddress = ipOverride ?? (req
      ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        req.headers.get('x-real-ip') ||
        '127.0.0.1'
      : '127.0.0.1')

    const userAgent = uaOverride ?? (req
      ? req.headers.get('user-agent') || 'Unknown'
      : 'Unknown')

    const oldValStr = typeof oldValues === 'object' && oldValues !== null
      ? JSON.stringify(oldValues)
      : String(oldValues || '')

    const newValStr = typeof newValues === 'object' && newValues !== null
      ? JSON.stringify(newValues)
      : String(newValues || '')

    await db.insert(auditLogs).values({
      userActionType,
      tableName,
      recordId: String(recordId),
      oldValues: oldValStr,
      newValues: newValStr,
      ipAddress,
      userAgent,
      authorName: name || 'Admin',
      authorRole: role || 'Management',
      schoolId: schoolId ?? ((newValues?.schoolId) || (oldValues?.schoolId) || null)
    })
  } catch (error) {
    console.error('Failed to log audit action:', error)
  }
}
