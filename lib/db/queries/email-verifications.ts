import { eq } from 'drizzle-orm'
import { db } from '../index'
import { emailVerifications, type EmailVerification, type NewEmailVerification } from '../schema'

export async function createEmailVerification(
  data: NewEmailVerification
): Promise<EmailVerification> {
  const rows = await db.insert(emailVerifications).values(data).returning()
  return rows[0]
}

export async function findVerificationByToken(token: string): Promise<EmailVerification | null> {
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.token, token))
  return rows[0] ?? null
}

export async function deleteVerificationByToken(token: string): Promise<void> {
  await db.delete(emailVerifications).where(eq(emailVerifications.token, token))
}
