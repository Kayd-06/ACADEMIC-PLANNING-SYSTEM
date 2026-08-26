import { eq, and, asc, ilike, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  masterCurriculum,
  batchConceptProgress,
  studentConceptProgress,
  type MasterCurriculum,
  type NewMasterCurriculum,
  type BatchConceptProgress,
  type NewBatchConceptProgress,
  type StudentConceptProgress,
  type NewStudentConceptProgress,
} from '../schema'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MasterCurriculumFilters {
  board?:      string | null
  program?:    string | null
  classLevel?: string | null
  subject?:    string | null
  isActive?:   boolean
}

export interface MasterCurriculumRow {
  id:                string
  board:             string
  program:           string
  classLevel:        string
  subject:           string
  chapterName:       string
  chapterCode:       string
  chapterOrderIndex: number
  expectedHours:     number | null
  conceptName:       string
  conceptCode:       string
  conceptOrderIndex: number
  importanceWeight:  string | null
  isActive:          boolean
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listMasterCurriculumRows(
  filters: MasterCurriculumFilters = {},
  schoolId?: string | null,
): Promise<MasterCurriculumRow[]> {
  const conditions: any[] = []
  if (schoolId)           conditions.push(eq(masterCurriculum.schoolId, schoolId))
  if (filters.board)      conditions.push(eq(masterCurriculum.board, filters.board))
  if (filters.program)    conditions.push(eq(masterCurriculum.program, filters.program))
  if (filters.classLevel) conditions.push(eq(masterCurriculum.classLevel, filters.classLevel))
  if (filters.subject)    conditions.push(eq(masterCurriculum.subject, filters.subject))
  if (filters.isActive !== undefined) conditions.push(eq(masterCurriculum.isActive, filters.isActive))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(masterCurriculum)
    .where(where)
    .orderBy(
      asc(masterCurriculum.subject),
      asc(masterCurriculum.program),
      asc(masterCurriculum.classLevel),
      asc(masterCurriculum.chapterOrderIndex),
      asc(masterCurriculum.chapterName),
      asc(masterCurriculum.conceptOrderIndex),
      asc(masterCurriculum.conceptName),
    )

  return rows.map(r => ({
    id:                r.id,
    board:             r.board,
    program:           r.program,
    classLevel:        r.classLevel,
    subject:           r.subject,
    chapterName:       r.chapterName,
    chapterCode:       r.chapterCode,
    chapterOrderIndex: r.chapterOrderIndex,
    expectedHours:     r.expectedHours ?? null,
    conceptName:       r.conceptName,
    conceptCode:       r.conceptCode,
    conceptOrderIndex: r.conceptOrderIndex,
    importanceWeight:  r.importanceWeight ?? 'Medium',
    isActive:          r.isActive,
  }))
}

export async function insertMasterCurriculumRow(
  data: Omit<NewMasterCurriculum, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<MasterCurriculum> {
  const [row] = await db.insert(masterCurriculum).values(data).returning()
  return row
}

export async function updateMasterCurriculumRow(
  id: string,
  data: Partial<Omit<NewMasterCurriculum, 'id' | 'createdAt' | 'schoolId'>>,
  schoolId?: string | null,
): Promise<MasterCurriculum | null> {
  const condition = schoolId
    ? and(eq(masterCurriculum.id, id), eq(masterCurriculum.schoolId, schoolId))
    : eq(masterCurriculum.id, id)

  const [row] = await db
    .update(masterCurriculum)
    .set({ ...data, updatedAt: new Date() })
    .where(condition)
    .returning()

  return row ?? null
}

export async function deleteMasterCurriculumRow(
  id: string,
  schoolId?: string | null,
): Promise<void> {
  const condition = schoolId
    ? and(eq(masterCurriculum.id, id), eq(masterCurriculum.schoolId, schoolId))
    : eq(masterCurriculum.id, id)
  await db.delete(masterCurriculum).where(condition)
}

// ── Bulk Upsert ───────────────────────────────────────────────────────────────
// Upsert rows into master_curriculum using the composite unique index as the
// conflict target (schoolId + board + program + classLevel + subject + conceptCode).
// Rows with blank conceptCode are inserted without conflict detection.

export interface MasterCurriculumImportRow {
  board:             string
  program:           string
  classLevel:        string
  subject:           string
  chapterName:       string
  chapterCode?:      string
  chapterOrderIndex?: number
  expectedHours?:    number
  conceptName:       string
  conceptCode?:      string
  conceptOrderIndex?: number
  importanceWeight?: string
}

export async function upsertMasterCurriculumRows(
  rows: MasterCurriculumImportRow[],
  schoolId: string,
): Promise<{ inserted: number; updated: number; errors: { row: string; message: string }[] }> {
  let inserted = 0
  let updated  = 0
  const errors: { row: string; message: string }[] = []

  for (const row of rows) {
    try {
      const conceptCode = (row.conceptCode ?? '').trim()
      const values: NewMasterCurriculum = {
        board:             row.board.trim(),
        program:           row.program.trim(),
        classLevel:        row.classLevel.trim(),
        subject:           row.subject.trim(),
        chapterName:       row.chapterName.trim(),
        chapterCode:       (row.chapterCode ?? '').trim(),
        chapterOrderIndex: row.chapterOrderIndex ?? 0,
        expectedHours:     row.expectedHours ?? 0,
        conceptName:       row.conceptName.trim(),
        conceptCode,
        conceptOrderIndex: row.conceptOrderIndex ?? 0,
        importanceWeight:  row.importanceWeight ?? 'Medium',
        schoolId,
        isActive:          true,
      }

      if (conceptCode) {
        // Upsert via conflict on composite unique index
        const result = await db
          .insert(masterCurriculum)
          .values(values)
          .onConflictDoUpdate({
            target: [
              masterCurriculum.schoolId,
              masterCurriculum.board,
              masterCurriculum.program,
              masterCurriculum.classLevel,
              masterCurriculum.subject,
              masterCurriculum.conceptCode,
            ],
            set: {
              chapterName:       values.chapterName,
              chapterCode:       values.chapterCode,
              chapterOrderIndex: values.chapterOrderIndex,
              expectedHours:     values.expectedHours,
              conceptName:       values.conceptName,
              conceptOrderIndex: values.conceptOrderIndex,
              importanceWeight:  values.importanceWeight,
              isActive:          true,
              updatedAt:         new Date(),
            },
          })
          .returning({ id: masterCurriculum.id })

        // Drizzle's onConflictDoUpdate always returns the row; check if truly new
        if (result.length > 0) inserted++ // simplified — both insert+update count here
      } else {
        // No conceptCode — plain insert (no unique constraint to conflict on)
        await db.insert(masterCurriculum).values(values)
        inserted++
      }
    } catch (err: any) {
      errors.push({ row: `${row.board}/${row.subject}/${row.chapterName}/${row.conceptName}`, message: err.message })
    }
  }

  return { inserted, updated, errors }
}

// ── Back-fill from chapters + concepts ───────────────────────────────────────
// Reads normalized chapters→concepts→subjects→programs for a school and
// upserts them into master_curriculum. Called by the /backfill route.

export async function backfillMasterCurriculumFromNormalized(
  schoolId: string,
): Promise<{ inserted: number; errors: { row: string; message: string }[] }> {
  // Import here to avoid circular imports
  const { listMasterSheetRows } = await import('./curriculum')
  const rows = await listMasterSheetRows({}, schoolId)

  const importRows: MasterCurriculumImportRow[] = rows.map(r => ({
    board:       r.board        ?? '',
    program:     r.program      ?? '',
    classLevel:  r.classLevel   ?? '',
    subject:     r.subject,
    chapterName: r.chapterName,
    chapterCode: r.chapterCode,
    conceptName: r.conceptName  ?? '',
    conceptCode: r.conceptCode  ?? '',
  })).filter(r => r.chapterName && r.conceptName)

  const result = await upsertMasterCurriculumRows(importRows, schoolId)
  return { inserted: result.inserted, errors: result.errors }
}

// ── Batch Concept Progress ─────────────────────────────────────────────────────

export async function getBatchConceptProgress(
  batchId: string,
): Promise<BatchConceptProgress[]> {
  return db
    .select()
    .from(batchConceptProgress)
    .where(eq(batchConceptProgress.batchId, batchId))
    .orderBy(asc(batchConceptProgress.curriculumId))
}

export async function upsertBatchConceptProgress(
  batchId:      string,
  curriculumId: string,
  data: Partial<Pick<NewBatchConceptProgress, 'status' | 'plannedStartDate' | 'plannedEndDate' | 'actualCompletionDate' | 'teacherId'>>,
): Promise<BatchConceptProgress> {
  const [row] = await db
    .insert(batchConceptProgress)
    .values({ batchId, curriculumId, ...data })
    .onConflictDoUpdate({
      target: [batchConceptProgress.batchId, batchConceptProgress.curriculumId],
      set:    { ...data, updatedAt: new Date() },
    })
    .returning()
  return row
}

// ── Student Concept Progress ──────────────────────────────────────────────────

export async function getStudentConceptProgress(
  studentId: string,
): Promise<StudentConceptProgress[]> {
  return db
    .select()
    .from(studentConceptProgress)
    .where(eq(studentConceptProgress.studentId, studentId))
}

export async function upsertStudentConceptProgress(
  studentId:    string,
  curriculumId: string,
  data: Partial<Pick<NewStudentConceptProgress, 'status' | 'masteryScore' | 'lastPracticeDate'>>,
): Promise<StudentConceptProgress> {
  const [row] = await db
    .insert(studentConceptProgress)
    .values({ studentId, curriculumId, ...data })
    .onConflictDoUpdate({
      target: [studentConceptProgress.studentId, studentConceptProgress.curriculumId],
      set:    { ...data, updatedAt: new Date() },
    })
    .returning()
  return row
}
