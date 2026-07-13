import { eq, desc } from 'drizzle-orm'
import { db } from '../index'
import { emailVerifications, type EmailVerification, type NewEmailVerification } from '../schema'

export async function createEmailVerification(
  data: NewEmailVerification
): Promise<EmailVerification> {
  const rows = await db.insert(emailVerifications).values(data).returning()
  return rows[0]
}

// A user may have requested more than one code (e.g. after a resend) —
// only the most recent one is ever valid.
export async function findLatestVerificationForUser(userId: string): Promise<EmailVerification | null> {
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.userId, userId))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1)
  return rows[0] ?? null
}

export async function incrementVerificationAttempts(id: string): Promise<void> {
  const [row] = await db.select({ attempts: emailVerifications.attempts }).from(emailVerifications).where(eq(emailVerifications.id, id))
  if (!row) return
  await db.update(emailVerifications).set({ attempts: row.attempts + 1 }).where(eq(emailVerifications.id, id))
}

export async function deleteVerificationsForUser(userId: string): Promise<void> {
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId))
}
