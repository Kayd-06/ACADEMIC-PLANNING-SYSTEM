import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chapters, concepts, type NewChapter, type NewConcept } from '@/lib/db/schema'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'
import { runBatch, type BatchStatement } from '@/lib/db/batch'

// Shared chapter + concept import used by /api/curriculum/bulk-import and
// /api/curriculum/master-curriculum/bulk-import. Instead of 1–3 queries per
// row (all rows in flight at once, or strictly one-by-one), it prefetches the
// subject's chapters and concepts once and writes in chunks of 100, 3 chunks
// at a time, each chunk in one transaction.
//
// There is no unique key on chapters(subject, name) or concepts(chapter, name)
// (existing data may already contain duplicates), so matching is done against
// the prefetch, case-insensitively. Two imports of the same subject running at
// the very same moment can still both insert a chapter — see the PR notes.

const CHUNK_SIZE = 100
const CONCURRENCY = 3

export interface CurriculumImportRow {
  chapterName?: string
  chapterCode?: string
  board?: string
  classLevel?: string
  program?: string
  expectedHours?: string
  conceptName?: string
  conceptCode?: string
}

export interface CurriculumImportError {
  row: string
  level: 'chapter' | 'concept'
  message: string
}

export interface CurriculumImportOptions {
  subjectId: string
  schoolId: string
  rows: CurriculumImportRow[]
  programIdByName: Map<string, string>
  /** update code/board/classLevel/hours/program of existing chapters and code of existing concepts */
  updateExisting: boolean
  /** a chapter naming an unknown program fails (true) or is saved without a program (false) */
  strictProgram: boolean
}

interface ChapterGroup {
  key: string
  name: string
  code: string
  board: string
  classLevel: string
  program: string
  expectedHours: string
  rowLabel: string
}

const GENERIC_CHUNK_ERROR = 'Could not be saved. Please try again.'

export async function importChaptersAndConcepts(opts: CurriculumImportOptions) {
  const { subjectId, schoolId, rows, programIdByName, updateExisting, strictProgram } = opts
  const errors: CurriculumImportError[] = []

  // Pass 1 — group rows into unique chapters by name (case-insensitive),
  // merging in values from whichever row first supplies a non-empty one.
  const groups = new Map<string, ChapterGroup>()
  rows.forEach((r, i) => {
    const name = r.chapterName?.trim() || ''
    if (!name) {
      errors.push({ row: `Row ${i + 1}`, level: 'chapter', message: 'Chapter Name is required' })
      return
    }
    const key = name.toLowerCase()
    const values = {
      code: r.chapterCode?.trim() || '',
      board: r.board?.trim() || '',
      classLevel: r.classLevel?.trim() || '',
      program: r.program?.trim() || '',
      expectedHours: r.expectedHours?.toString().trim() || '',
    }
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { key, name, ...values, rowLabel: `Row ${i + 1}` })
    } else {
      for (const f of ['code', 'board', 'classLevel', 'program', 'expectedHours'] as const) {
        if (!existing[f] && values[f]) existing[f] = values[f]
      }
    }
  })

  // Pass 2 — chapters, matched by name within the subject + school.
  const existingChapters = await db.select({ id: chapters.id, name: chapters.name })
    .from(chapters)
    .where(and(eq(chapters.subjectId, subjectId), eq(chapters.schoolId, schoolId)))
  const existingChapterId = new Map<string, string>()
  for (const c of existingChapters) {
    const k = c.name.trim().toLowerCase()
    if (!existingChapterId.has(k)) existingChapterId.set(k, c.id)
  }

  type ChapterPlan = { group: ChapterGroup; id: string; insert?: NewChapter; update?: Partial<NewChapter> }
  const chapterPlans: ChapterPlan[] = []
  let chaptersFailed = 0
  for (const group of groups.values()) {
    const programId = group.program ? programIdByName.get(group.program.toLowerCase()) : undefined
    if (group.program && !programId && strictProgram) {
      errors.push({ row: group.rowLabel, level: 'chapter', message: `Program "${group.program}" was not found for this school` })
      chaptersFailed++
      continue
    }
    const hours = group.expectedHours ? Number(group.expectedHours) : null
    const data: Partial<NewChapter> = {
      code: group.code,
      board: group.board || null,
      classLevel: group.classLevel || null,
      expectedHours: hours !== null && !Number.isNaN(hours) ? hours : null,
    }
    // Only touch programId when the row named one, so re-importing a chapter
    // without a Program column doesn't drop an existing link.
    if (group.program) data.programId = programId ?? null
    const existingId = existingChapterId.get(group.key)
    if (existingId) {
      chapterPlans.push({ group, id: existingId, update: updateExisting ? { ...data, name: group.name } : undefined })
    } else {
      const id = crypto.randomUUID()
      chapterPlans.push({ group, id, insert: { ...data, id, name: group.name, subjectId, schoolId } as NewChapter })
    }
  }

  const chapterIdByKey = new Map<string, string>()
  const chapterParts = chunk(chapterPlans, CHUNK_SIZE)
  const chapterResults = await mapWithConcurrency(chapterParts, CONCURRENCY, async (part) => {
    const statements: BatchStatement[] = []
    const inserts = part.flatMap(p => (p.insert ? [p.insert] : []))
    if (inserts.length > 0) statements.push(db.insert(chapters).values(inserts))
    for (const p of part) {
      if (p.update) {
        statements.push(db.update(chapters).set(p.update)
          .where(and(eq(chapters.id, p.id), eq(chapters.schoolId, schoolId))))
      }
    }
    await runBatch(statements)
  })
  chapterResults.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      for (const p of chapterParts[i]) chapterIdByKey.set(p.group.key, p.id)
      return
    }
    console.error('[curriculum import] chapter chunk failed', r.reason)
    for (const p of chapterParts[i]) {
      chaptersFailed++
      errors.push({ row: p.group.rowLabel, level: 'chapter', message: GENERIC_CHUNK_ERROR })
    }
  })

  // Pass 3 — concepts under their resolved chapter, matched by name within it.
  const conceptRows = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.chapterName?.trim() && r.conceptName?.trim())

  const resolvedChapterIds = [...new Set(chapterIdByKey.values())]
  const existingConcepts = resolvedChapterIds.length > 0
    ? await db.select({ id: concepts.id, chapterId: concepts.chapterId, name: concepts.name, code: concepts.code })
        .from(concepts).where(inArray(concepts.chapterId, resolvedChapterIds))
    : []
  const existingConcept = new Map<string, { id: string; code: string }>()
  for (const c of existingConcepts) {
    const k = `${c.chapterId}|${c.name.trim().toLowerCase()}`
    if (!existingConcept.has(k)) existingConcept.set(k, { id: c.id, code: c.code })
  }

  // Several rows naming the same concept become one write (last code wins).
  type ConceptPlan = { key: string; rowIndexes: number[]; chapterId: string; name: string; code: string; existingId?: string; existingCode?: string }
  const conceptPlans = new Map<string, ConceptPlan>()
  let conceptsFailed = 0
  for (const { r, i } of conceptRows) {
    const chapterId = chapterIdByKey.get(r.chapterName!.trim().toLowerCase())
    if (!chapterId) {
      conceptsFailed++
      errors.push({ row: `Row ${i + 1}`, level: 'concept', message: `Skipped — chapter "${r.chapterName!.trim()}" failed to import` })
      continue
    }
    const name = r.conceptName!.trim()
    const code = r.conceptCode?.trim() || ''
    const key = `${chapterId}|${name.toLowerCase()}`
    const plan = conceptPlans.get(key)
    if (plan) {
      plan.rowIndexes.push(i)
      plan.code = code
    } else {
      const ex = existingConcept.get(key)
      conceptPlans.set(key, { key, rowIndexes: [i], chapterId, name, code, existingId: ex?.id, existingCode: ex?.code })
    }
  }

  const conceptParts = chunk([...conceptPlans.values()], CHUNK_SIZE)
  const conceptResults = await mapWithConcurrency(conceptParts, CONCURRENCY, async (part) => {
    const statements: BatchStatement[] = []
    const inserts: NewConcept[] = part.filter(p => !p.existingId)
      .map(p => ({ name: p.name, code: p.code, chapterId: p.chapterId, schoolId }))
    if (inserts.length > 0) statements.push(db.insert(concepts).values(inserts))
    if (updateExisting) {
      for (const p of part) {
        if (p.existingId && p.existingCode !== p.code) {
          statements.push(db.update(concepts).set({ code: p.code }).where(eq(concepts.id, p.existingId)))
        }
      }
    }
    await runBatch(statements)
  })
  let conceptsSucceeded = 0
  conceptResults.forEach((r, i) => {
    const rowsInPart = conceptParts[i].flatMap(p => p.rowIndexes)
    if (r.status === 'fulfilled') {
      conceptsSucceeded += rowsInPart.length
      return
    }
    console.error('[curriculum import] concept chunk failed', r.reason)
    for (const idx of rowsInPart) {
      conceptsFailed++
      errors.push({ row: `Row ${idx + 1}`, level: 'concept', message: GENERIC_CHUNK_ERROR })
    }
  })

  return {
    errors,
    chapters: { succeeded: chapterIdByKey.size, failed: chaptersFailed, total: groups.size },
    concepts: { succeeded: conceptsSucceeded, failed: conceptsFailed, total: conceptRows.length },
  }
}

