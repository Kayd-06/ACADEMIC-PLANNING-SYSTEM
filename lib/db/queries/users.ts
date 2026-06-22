import { eq } from 'drizzle-orm'
import { db } from '../index'
import { users, type NewUser, type User } from '../schema'

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
  return rows[0] ?? null
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id))
  return rows[0] ?? null
}

export async function createUser(data: NewUser): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ ...data, email: data.email.toLowerCase() })
    .returning()
  return rows[0]
}

export async function updateUserStatus(
  id: string,
  status: 'pending_verification' | 'active'
): Promise<User | null> {
  const rows = await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return rows[0] ?? null
}
