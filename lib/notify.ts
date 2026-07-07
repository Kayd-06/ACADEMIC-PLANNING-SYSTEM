import { eq, and, inArray } from 'drizzle-orm'
import { db } from './db'
import { users, notifications } from './db/schema'

export type NotificationCategory = 'Announcement' | 'Result' | 'Assignment' | 'Fee' | 'Attendance' | 'General'

interface NotifyPayload {
  category: NotificationCategory
  title: string
  message?: string
  link?: string
  schoolId?: string | null
}

// Insert one notification per user id
export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  if (userIds.length === 0) return
  await db.insert(notifications).values(
    userIds.map(userId => ({
      userId,
      category: payload.category,
      title: payload.title,
      message: payload.message ?? '',
      link: payload.link ?? '',
      schoolId: payload.schoolId ?? null,
    }))
  )
}

// Fan out to every user of the given role(s) in a school.
// roles: 'teacher' | 'management'; schoolId null = legacy users without school
export async function notifyRoleInSchool(
  roles: Array<'teacher' | 'management'>,
  schoolId: string | null,
  payload: NotifyPayload
): Promise<void> {
  const conditions = [inArray(users.role, roles)]
  if (schoolId) conditions.push(eq(users.schoolId, schoolId))
  const rows = await db.select({ id: users.id }).from(users).where(and(...conditions))
  await notifyUsers(rows.map(r => r.id), { ...payload, schoolId })
}
