import { eq } from 'drizzle-orm'
import { db } from '../index'
import { schools, type School, type NewSchool } from '../schema'

export async function getOrCreateSchool(): Promise<School> {
  const existing = await db.select().from(schools).limit(1)
  if (existing[0]) return existing[0]

  const created = await db.insert(schools).values({}).returning()
  return created[0]
}

export async function updateSchool(data: Partial<NewSchool>): Promise<School> {
  const school = await getOrCreateSchool()
  const updated = await db
    .update(schools)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schools.id, school.id))
    .returning()
  return updated[0]
}
