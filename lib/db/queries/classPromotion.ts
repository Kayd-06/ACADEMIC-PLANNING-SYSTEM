import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, users } from '../schema'
import { isEligibleForPromotion, type PromotionCandidate } from '@/lib/classPromotion'

export interface EligibleStudent extends PromotionCandidate {
  id: string
  batch: string
}

export async function getEligibleStudents(schoolId: string, previousBoundaryDate: string): Promise<EligibleStudent[]> {
  const rows = await db
    .select({ id: students.id, class: students.class, admissionDate: students.admissionDate, batch: students.batch, isActive: students.isActive })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), inArray(students.class, ['9', '10', '11'])))
  return rows.filter((s) => isEligibleForPromotion(s, previousBoundaryDate))
}

export async function getExcludedNewAdmissionCount(schoolId: string, previousBoundaryDate: string): Promise<number> {
  const rows = await db
    .select({ admissionDate: students.admissionDate })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), inArray(students.class, ['9', '10', '11'])))
  return rows.filter((r) => !!r.admissionDate && r.admissionDate >= previousBoundaryDate).length
}

export async function getActiveClass12Count(schoolId: string): Promise<number> {
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.isActive, true), eq(students.class, '12')))
  return rows.length
}

export async function getManagementUserIds(schoolId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, 'management')))
  return rows.map((r) => r.id)
}
