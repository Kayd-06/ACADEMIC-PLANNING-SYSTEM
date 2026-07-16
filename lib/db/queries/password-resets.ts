import { eq, desc } from 'drizzle-orm'
import { db } from '../index'
import { passwordResets, type PasswordReset, type NewPasswordReset } from '../schema'

export async function createPasswordReset(data: NewPasswordReset): Promise<PasswordReset> {
  const rows = await db.insert(passwordResets).values(data).returning()
  return rows[0]
}

// A user may have requested more than one code — only the most recent one is ever valid.
export async function findLatestPasswordResetForUser(userId: string): Promise<PasswordReset | null> {
  const rows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.userId, userId))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function incrementPasswordResetAttempts(id: string): Promise<void> {
  const [row] = await db.select({ attempts: passwordResets.attempts }).from(passwordResets).where(eq(passwordResets.id, id))
  if (!row) return
  await db.update(passwordResets).set({ attempts: row.attempts + 1 }).where(eq(passwordResets.id, id))
}

export async function deletePasswordResetsForUser(userId: string): Promise<void> {
  await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
}
