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
// A missing school id used to mean "notify every user of that role in every
// school" — now it is a no-op (logged), so one school's events never reach
// another school's staff.
export async function notifyRoleInSchool(
  roles: Array<'teacher' | 'management'>,
  schoolId: string | null,
  payload: NotifyPayload,
  getLink?: (role: 'teacher' | 'management') => string
): Promise<void> {
  if (!schoolId) {
    console.warn(`[notify] skipped "${payload.title}": no schoolId (would have notified every school)`)
    return
  }
  const conditions = [
    inArray(users.role, roles),
    or(eq(users.schoolId, schoolId), eq(users.activeSchoolId, schoolId)),
  ]
  const rows = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(and(...conditions))
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
