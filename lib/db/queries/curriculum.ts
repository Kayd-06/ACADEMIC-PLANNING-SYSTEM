import { eq, and, asc } from 'drizzle-orm'
import { db } from '../index'
import { chapters, concepts, type Chapter, type NewChapter, type Concept, type NewConcept } from '../schema'

export async function listChaptersBySubject(subjectId: string, schoolId?: string | null): Promise<Chapter[]> {
  const conditions: any[] = [eq(chapters.subjectId, subjectId)]
  if (schoolId) conditions.push(eq(chapters.schoolId, schoolId))
  return db
    .select()
    .from(chapters)
    .where(and(...conditions))
    .orderBy(asc(chapters.orderIndex), asc(chapters.name))
}

export async function createChapter(data: NewChapter): Promise<Chapter> {
  const rows = await db.insert(chapters).values(data).returning()
  return rows[0]
}

export async function updateChapter(id: string, data: Partial<NewChapter>, schoolId?: string | null): Promise<Chapter | null> {
  const condition = schoolId ? and(eq(chapters.id, id), eq(chapters.schoolId, schoolId)) : eq(chapters.id, id)
  const rows = await db.update(chapters).set(data).where(condition).returning()
  return rows[0] ?? null
}

export async function deleteChapter(id: string, schoolId?: string | null): Promise<void> {
  const condition = schoolId ? and(eq(chapters.id, id), eq(chapters.schoolId, schoolId)) : eq(chapters.id, id)
  await db.delete(chapters).where(condition)
}

export async function listConceptsByChapter(chapterId: string, schoolId?: string | null): Promise<Concept[]> {
  const conditions: any[] = [eq(concepts.chapterId, chapterId)]
  if (schoolId) conditions.push(eq(concepts.schoolId, schoolId))
  return db
    .select()
    .from(concepts)
    .where(and(...conditions))
    .orderBy(asc(concepts.orderIndex), asc(concepts.name))
}

export async function createConcept(data: NewConcept): Promise<Concept> {
  const rows = await db.insert(concepts).values(data).returning()
  return rows[0]
}

export async function updateConcept(id: string, data: Partial<NewConcept>, schoolId?: string | null): Promise<Concept | null> {
  const condition = schoolId ? and(eq(concepts.id, id), eq(concepts.schoolId, schoolId)) : eq(concepts.id, id)
  const rows = await db.update(concepts).set(data).where(condition).returning()
  return rows[0] ?? null
}

export async function deleteConcept(id: string, schoolId?: string | null): Promise<void> {
  const condition = schoolId ? and(eq(concepts.id, id), eq(concepts.schoolId, schoolId)) : eq(concepts.id, id)
  await db.delete(concepts).where(condition)
}
