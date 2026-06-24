import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, type Student, type NewStudent } from '../schema'

export interface ListStudentsFilters {
  class?: string
  section?: string
  activeOnly?: boolean
}

export async function listStudents(filters: ListStudentsFilters = {}): Promise<Student[]> {
  const conditions = []
  if (filters.activeOnly !== false) conditions.push(eq(students.isActive, true))
  if (filters.class) conditions.push(eq(students.class, filters.class))
  if (filters.section) conditions.push(eq(students.section, filters.section))

  if (conditions.length === 0) {
    return db.select().from(students).orderBy(students.class, students.section, students.rollNo)
  }
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.class, students.section, students.rollNo)
}

export async function findStudentsByClasses(classes: string[], activeOnly = true): Promise<Student[]> {
  const conditions = [inArray(students.class, classes)]
  if (activeOnly) conditions.push(eq(students.isActive, true))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function countStudentsByClasses(classes: string[]): Promise<number> {
  const rows = await db.select().from(students).where(inArray(students.class, classes))
  return rows.length
}

export async function deleteStudentsByClasses(classes: string[]): Promise<void> {
  await db.delete(students).where(inArray(students.class, classes))
}

export async function getStudentById(id: string): Promise<Student | null> {
  const rows = await db.select().from(students).where(eq(students.id, id))
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

export async function upsertStudentByRollClassSection(data: NewStudent): Promise<Student> {
  const existing = await db
    .select()
    .from(students)
    .where(
      and(
        eq(students.rollNo, data.rollNo ?? ''),
        eq(students.class, data.class ?? ''),
        eq(students.section, data.section ?? '')
      )
    )
  if (existing[0]) {
    const updated = await db
      .update(students)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(students.id, existing[0].id))
      .returning()
    return updated[0]
  }
  return createStudent(data)
}

export async function updateStudent(id: string, data: Partial<NewStudent>): Promise<Student | null> {
  const rows = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deactivateStudent(id: string): Promise<Student | null> {
  return updateStudent(id, { isActive: false })
}

export async function deleteStudent(id: string): Promise<void> {
  await db.delete(students).where(eq(students.id, id))
}

export async function deleteAllStudents(): Promise<void> {
  await db.delete(students)
}
