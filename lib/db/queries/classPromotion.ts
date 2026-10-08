import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../index'
import { students, users, classPromotionRuns, notifications } from '../schema'
import {
  isEligibleForPromotion,
  computeBoundaryDate,
  subtractOneYear,
  computeAcademicYearLabel,
  buildPreviewCounts,
  type PromotionCandidate,
} from '@/lib/classPromotion'

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

// Shared by the daily cron and the management "Check now" trigger. Idempotent
// per academic year: a second call for the same school on the same boundary
// is a no-op because a run for that academicYear already exists.
export async function runPromotionDetectionForSchool(
  schoolId: string,
  academicYearStartMonth: number
): Promise<{ created: boolean; academicYear: string }> {
  const boundaryDate = computeBoundaryDate(academicYearStartMonth)
  const academicYear = computeAcademicYearLabel(boundaryDate)

  const existing = await db
    .select({ id: classPromotionRuns.id })
    .from(classPromotionRuns)
    .where(and(eq(classPromotionRuns.schoolId, schoolId), eq(classPromotionRuns.academicYear, academicYear)))
  if (existing.length > 0) return { created: false, academicYear }

  const previousBoundaryDate = subtractOneYear(boundaryDate)
  const eligible = await getEligibleStudents(schoolId, previousBoundaryDate)
  const excludedNewAdmissionCount = await getExcludedNewAdmissionCount(schoolId, previousBoundaryDate)
  const excludedTerminalCount = await getActiveClass12Count(schoolId)
  const previewCounts = buildPreviewCounts(eligible)

  // The (school, academicYear) unique index makes this idempotent even when
  // the cron and a "Check now" click race: only one insert returns a row.
  const inserted = await db.insert(classPromotionRuns).values({
    schoolId,
    academicYear,
    boundaryDate,
    status: 'pending',
    previewCounts,
    excludedNewAdmissionCount,
    excludedTerminalCount,
  }).onConflictDoNothing({ target: [classPromotionRuns.schoolId, classPromotionRuns.academicYear] })
    .returning({ id: classPromotionRuns.id })
  if (inserted.length === 0) return { created: false, academicYear }

  // One multi-row insert instead of one INSERT per user; a notification
  // failure must not make the (already committed) run look failed.
  try {
    const managementUserIds = await getManagementUserIds(schoolId)
    if (managementUserIds.length > 0) {
      await db.insert(notifications).values(managementUserIds.map((userId) => ({
        userId,
        category: 'General',
        title: 'Class promotion ready for review',
        message: `${academicYear} class promotion is ready to review for your school.`,
        link: '/management/academic-planning?tab=Promotion',
        schoolId,
      })))
    }
  } catch (error) {
    console.error('[class-promotion] failed to notify management', error)
  }

  return { created: true, academicYear }
}
