import { eq, and, inArray, or } from 'drizzle-orm'
import { db } from './db'
import { users, notifications } from './db/schema'

export type NotificationCategory = 'Announcement' | 'Result' | 'Assignment' | 'Fee' | 'Attendance' | 'General'

interface NotifyPayload {
  category: NotificationCategory
  title: string
  message?: string
  link?: string
  schoolId?: string | null
  createdAt?: Date
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
      createdAt: payload.createdAt ?? new Date(),
    }))
  )
}

// Fan out to every user of the given role(s) in a school.
// roles: 'teacher' | 'management'; schoolId null = legacy users without school
export async function notifyRoleInSchool(
  roles: Array<'teacher' | 'management'>,
  schoolId: string | null,
  payload: NotifyPayload,
  getLink?: (role: 'teacher' | 'management') => string
): Promise<void> {
  const conditions = [inArray(users.role, roles)]
  if (schoolId) {
    conditions.push(
      or(
        eq(users.schoolId, schoolId as string),
        eq(users.activeSchoolId, schoolId as string)
      ) as any
    )
  }
  const rows = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(and(...conditions.filter((c): c is any => !!c)))
  if (rows.length === 0) return

  await db.insert(notifications).values(
    rows.map(row => {
      const role = row.role as 'teacher' | 'management'
      const link = getLink ? getLink(role) : (payload.link ?? '')
      return {
        userId: row.id,
        category: payload.category,
        title: payload.title,
        message: payload.message ?? '',
        link,
        schoolId: schoolId ?? null,
        createdAt: payload.createdAt ?? new Date(),
      }
    })
  )
}
