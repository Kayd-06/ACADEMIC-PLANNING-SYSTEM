import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, type Student, type NewStudent } from '../schema'

export interface ListStudentsFilters {
  class?: string
  activeOnly?: boolean
  schoolId?: string | null
}

export async function listStudents(filters: ListStudentsFilters = {}): Promise<Student[]> {
  const conditions: any[] = []
  if (filters.activeOnly !== false) conditions.push(eq(students.isActive, true))
  if (filters.class) conditions.push(eq(students.class, filters.class))
  if (filters.schoolId) conditions.push(eq(students.schoolId, filters.schoolId))

  if (conditions.length === 0) {
    return db.select().from(students).orderBy(students.class, students.rollNo)
  }
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.class, students.rollNo)
}

export async function findStudentsByClasses(classes: string[], activeOnly = true, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [inArray(students.class, classes)]
  if (activeOnly) conditions.push(eq(students.isActive, true))
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function findStudentsByBatch(batch: string, schoolId?: string | null): Promise<Student[]> {
  const conditions: any[] = [eq(students.batch, batch), eq(students.isActive, true)]
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  return db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.rollNo, students.name)
}

export async function countStudentsByClasses(classes: string[], schoolId?: string | null): Promise<number> {
  const conditions: any[] = [inArray(students.class, classes)]
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  const rows = await db.select().from(students).where(and(...conditions))
  return rows.length
}

export async function deleteStudentsByClasses(classes: string[], schoolId?: string | null): Promise<void> {
  const conditions: any[] = [inArray(students.class, classes)]
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  await db.delete(students).where(and(...conditions))
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
  const conditions: any[] = [
    eq(students.rollNo, data.rollNo ?? ''),
    eq(students.class, data.class ?? ''),
  ]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))

  const existing = await db
    .select()
    .from(students)
    .where(and(...conditions))
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

export async function upsertStudentByAdmissionNumber(data: NewStudent): Promise<Student> {
  const conditions: any[] = [eq(students.admissionNumber, data.admissionNumber ?? '')]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))

  const existing = await db.select().from(students).where(and(...conditions))
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

export async function upsertStudentByNameClassSection(data: NewStudent): Promise<Student> {
  const conditions: any[] = [
    eq(students.name, data.name),
    eq(students.class, data.class ?? ''),
  ]
  if (data.schoolId) conditions.push(eq(students.schoolId, data.schoolId))

  const existing = await db.select().from(students).where(and(...conditions))
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

export async function updateStudent(id: string, data: Partial<NewStudent>, schoolId?: string | null): Promise<Student | null> {
  const condition = schoolId ? and(eq(students.id, id), eq(students.schoolId, schoolId)) : eq(students.id, id)
  const rows = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(condition)
    .returning()
  return rows[0] ?? null
}

export async function deleteStudent(id: string, schoolId?: string | null): Promise<void> {
  const condition = schoolId ? and(eq(students.id, id), eq(students.schoolId, schoolId)) : eq(students.id, id)
  await db.delete(students).where(condition)
}

export async function deleteAllStudents(schoolId?: string | null): Promise<void> {
  if (schoolId) {
    await db.delete(students).where(eq(students.schoolId, schoolId))
  } else {
    await db.delete(students)
  }
}
