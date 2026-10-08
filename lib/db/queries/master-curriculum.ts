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
import { chunk, mapWithConcurrency } from '@/lib/concurrency'

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
  const errors: { row: string; message: string }[] = []

  const toValues = (row: MasterCurriculumImportRow): NewMasterCurriculum => ({
    board:             row.board.trim(),
    program:           row.program.trim(),
    classLevel:        row.classLevel.trim(),
    subject:           row.subject.trim(),
    chapterName:       row.chapterName.trim(),
    chapterCode:       (row.chapterCode ?? '').trim(),
    chapterOrderIndex: row.chapterOrderIndex ?? 0,
    expectedHours:     Number.isFinite(row.expectedHours) ? row.expectedHours : 0,
    conceptName:       row.conceptName.trim(),
    conceptCode:       (row.conceptCode ?? '').trim(),
    conceptOrderIndex: row.conceptOrderIndex ?? 0,
    importanceWeight:  row.importanceWeight ?? 'Medium',
    schoolId,
    isActive:          true,
  })

  // Rows with a concept code upsert on curriculum_concept_unique; the same key
  // twice in one file collapses to the last row (a multi-row ON CONFLICT
  // statement may not touch the same row twice). Rows without a code have no
  // unique key and are plain inserts.
  const keyed = new Map<string, NewMasterCurriculum>()
  const plain: NewMasterCurriculum[] = []
  for (const row of rows) {
    const v = toValues(row)
    if (v.conceptCode) keyed.set([v.board, v.program, v.classLevel, v.subject, v.conceptCode].join('\u0000'), v)
    else plain.push(v)
  }

  const write = async (part: NewMasterCurriculum[], upsert: boolean) => {
    const q = db.insert(masterCurriculum).values(part)
    const rowsOut = upsert
      ? await q.onConflictDoUpdate({
          target: [
            masterCurriculum.schoolId,
            masterCurriculum.board,
            masterCurriculum.program,
            masterCurriculum.classLevel,
            masterCurriculum.subject,
            masterCurriculum.conceptCode,
          ],
          targetWhere: sql`concept_code <> ''`,
          set: {
            chapterName:       sql.raw('excluded.chapter_name'),
            chapterCode:       sql.raw('excluded.chapter_code'),
            chapterOrderIndex: sql.raw('excluded.chapter_order_index'),
            expectedHours:     sql.raw('excluded.expected_hours'),
            conceptName:       sql.raw('excluded.concept_name'),
            conceptOrderIndex: sql.raw('excluded.concept_order_index'),
            importanceWeight:  sql.raw('excluded.importance_weight'),
            isActive:          true,
            updatedAt:         sql`now()`,
          },
        }).returning({ id: masterCurriculum.id })
      : await q.returning({ id: masterCurriculum.id })
    return rowsOut.length
  }

  // Chunks of 100, 3 at a time (previously one round trip per row).
  const jobs = [
    ...chunk([...keyed.values()], 100).map(part => ({ part, upsert: true })),
    ...chunk(plain, 100).map(part => ({ part, upsert: false })),
  ]
  const results = await mapWithConcurrency(jobs, 3, job => write(job.part, job.upsert))
  let inserted = 0 // as before, inserts and updates are both counted here
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { inserted += r.value; return }
    console.error('[master_curriculum import] chunk failed', r.reason)
    for (const v of jobs[i].part) {
      errors.push({ row: `${v.board}/${v.subject}/${v.chapterName}/${v.conceptName}`, message: 'Could not be saved' })
    }
  })

  return { inserted, updated: 0, errors }
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
