import { eq, and, inArray, sql } from 'drizzle-orm'
import { db } from '../index'
import { students, type Student, type NewStudent } from '../schema'
import { schoolScope } from '@/lib/tenant'

// Every query here is scoped to one school. A missing schoolId matches NO rows
// (schoolScope -> `false`) — it is never treated as "all schools".

export interface ListStudentsFilters {
  class?: string
  batch?: string
  activeOnly?: boolean
  schoolId?: string | null
}

export async function listStudents(filters: ListStudentsFilters = {}): Promise<Student[]> {
  const conditions: any[] = []
  if (filters.activeOnly !== false) conditions.push(eq(students.isActive, true))
  if (filters.class) conditions.push(eq(students.class, filters.class))
  if (filters.batch) conditions.push(eq(students.batch, filters.batch))
  conditions.push(schoolScope(students.schoolId, filters.schoolId))

  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.class, students.rollNo)
}

export async function findStudentsByClasses(classes: string[], activeOnly = true, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [inArray(students.class, classes)]
  if (activeOnly) conditions.push(eq(students.isActive, true))
  conditions.push(schoolScope(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function findStudentsByBatch(batch: string, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [eq(students.batch, batch), eq(students.isActive, true)]
  conditions.push(schoolScope(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function findStudentsByBatchId(batchId: string, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [eq(students.batchId, batchId), eq(students.isActive, true)]
  conditions.push(schoolScope(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function countStudentsByClasses(classes: string[], schoolId?: string | null): Promise<number> {
  const conditions: any[] = [inArray(students.class, classes)]
  conditions.push(schoolScope(students.schoolId, schoolId))
  const rows = await db.select({ id: students.id }).from(students).where(and(...conditions))
  return rows.length
}

export async function deleteStudentsByClasses(classes: string[], schoolId?: string | null): Promise<void> {
  const conditions: any[] = [inArray(students.class, classes)]
  conditions.push(schoolScope(students.schoolId, schoolId))
  await db.delete(students).where(and(...conditions))
}

export async function getStudentById(id: string, schoolId: string | null | undefined): Promise<Student | null> {
  const rows = await db.select().from(students).where(and(eq(students.id, id), schoolScope(students.schoolId, schoolId)))
  return rows[0] ?? null
}

export async function createStudent(data: NewStudent): Promise<Student> {
  const rows = await db.insert(students).values(data).returning()
  return rows[0]
}

export async function bulkInsertStudents(data: NewStudent[]): Promise<Student[]> {
  if (data.length === 0) return []
  return db.insert(students).values(data).returning()
}

/**
 * Atomic upsert on the (school_id, roll_no, class, section) unique key
 * (migration 0051). Rows without a complete key are simply inserted.
 */
export async function upsertStudentByRollClassSection(data: NewStudent): Promise<Student> {
  const keyed = !!data.schoolId && !!data.rollNo && !!data.class
  if (!keyed) return createStudent(data)
  const updatable: Partial<NewStudent> = { ...data }
  delete updatable.id
  delete updatable.createdAt
  const rows = await db
    .insert(students)
    .values({ ...data, section: data.section ?? '' })
    .onConflictDoUpdate({
      target: [students.schoolId, students.rollNo, students.class, students.section],
      targetWhere: sql`"roll_no" <> '' AND "class" <> '' AND "school_id" IS NOT NULL`,
      set: { ...updatable, updatedAt: new Date() },
    })
    .returning()
  return rows[0]
}

export async function updateStudent(id: string, data: Partial<NewStudent>, schoolId: string | null | undefined): Promise<Student | null> {
  const condition = and(eq(students.id, id), schoolScope(students.schoolId, schoolId))
  const rows = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(condition)
    .returning()
  return rows[0] ?? null
}

export async function deleteStudent(id: string, schoolId: string | null | undefined): Promise<boolean> {
  const condition = and(eq(students.id, id), schoolScope(students.schoolId, schoolId))
  const rows = await db.delete(students).where(condition).returning({ id: students.id })
  return rows.length > 0
}

export async function deleteAllStudents(schoolId: string): Promise<void> {
  if (!schoolId) throw new Error('deleteAllStudents requires a schoolId')
  await db.delete(students).where(eq(students.schoolId, schoolId))
}
