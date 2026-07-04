import { eq, and } from 'drizzle-orm'
import { db } from '../index'
import { adminSchools, users, schools } from '../schema'

export async function getAdminSchools(userId: string) {
  const rows = await db
    .select({
      id: schools.id,
      name: schools.name,
      board: schools.board,
      classes: schools.classes,
      programs: schools.programs,
      mouStatus: schools.mouStatus,
      joinCode: schools.joinCode,
      isActive: schools.isActive,
      role: adminSchools.role,
      joinedAt: adminSchools.createdAt,
    })
    .from(adminSchools)
    .innerJoin(schools, eq(adminSchools.schoolId, schools.id))
    .where(eq(adminSchools.userId, userId))
    .orderBy(adminSchools.createdAt)
  return rows
}

export async function isAdminOfSchool(userId: string, schoolId: string) {
  const [row] = await db
    .select({ role: adminSchools.role })
    .from(adminSchools)
    .where(and(eq(adminSchools.userId, userId), eq(adminSchools.schoolId, schoolId)))
  return row ?? null
}

export async function addSchoolToAdmin(userId: string, schoolId: string, role: 'owner' | 'member' = 'member') {
  await db.insert(adminSchools).values({ userId, schoolId, role }).onConflictDoNothing()
}

export async function removeSchoolFromAdmin(userId: string, schoolId: string) {
  await db.delete(adminSchools).where(and(eq(adminSchools.userId, userId), eq(adminSchools.schoolId, schoolId)))
}

export async function setActiveSchool(userId: string, schoolId: string | null) {
  await db.update(users).set({ activeSchoolId: schoolId, updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function getActiveSchoolId(userId: string): Promise<string | null> {
  const [row] = await db.select({ activeSchoolId: users.activeSchoolId }).from(users).where(eq(users.id, userId))
  return row?.activeSchoolId ?? null
}
