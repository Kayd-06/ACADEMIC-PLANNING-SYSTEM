import { eq } from 'drizzle-orm'
import { db } from '../index'
import { schools, type School, type NewSchool } from '../schema'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function getSchoolById(id: string): Promise<School | null> {
  const rows = await db.select().from(schools).where(eq(schools.id, id))
  return rows[0] ?? null
}

export async function updateSchool(id: string, data: Partial<NewSchool>): Promise<School> {
  const [updated] = await db
    .update(schools)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schools.id, id))
    .returning()
  return updated
}

// Legacy: used only for initial single-school setup (before multi-school migration)
export async function getOrCreateSchool(): Promise<School> {
  const existing = await db.select().from(schools).limit(1)
  if (existing[0]) {
    if (!existing[0].joinCode) {
      const [updated] = await db.update(schools)
        .set({ joinCode: generateJoinCode(), updatedAt: new Date() })
        .where(eq(schools.id, existing[0].id))
        .returning()
      return updated
    }
    return existing[0]
  }

  const [created] = await db.insert(schools).values({ joinCode: generateJoinCode() }).returning()
  return created
}
