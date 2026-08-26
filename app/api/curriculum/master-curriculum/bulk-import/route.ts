import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { upsertMasterCurriculumRows, type MasterCurriculumImportRow } from '@/lib/db/queries/master-curriculum'
import { db } from '@/lib/db'
import { chapters, concepts, subjects, programs } from '@/lib/db/schema'
import { eq, and, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// POST — dual-write bulk import:
//   1. Upserts into chapters + concepts (backward compatible, existing flow)
//   2. Upserts into master_curriculum (new denormalized table)
//
// Body: { subjectId: string, rows: ParsedRow[] }
// where ParsedRow = { board, program, classLevel, chapterName, chapterCode, expectedHours, conceptName, conceptCode }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

    const body = await req.json()
    const { subjectId, rows } = body as {
      subjectId: string
      rows: Array<{
        chapterName:   string
        chapterCode:   string
        board:         string
        classLevel:    string
        program:       string
        expectedHours: string
        conceptName:   string
        conceptCode:   string
      }>
    }

    if (!subjectId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'subjectId and rows are required' }, { status: 400 })
    }

    // ── Resolve subject name for master_curriculum ──────────────────────────
    const [subjectRow] = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, subjectId))

    if (!subjectRow) return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    const subjectName = subjectRow.name

    // ── Resolve all unique program names to IDs (for chapter FK) ───────────
    const programNames = [...new Set(rows.map(r => (r.program ?? '').trim().toLowerCase()).filter(Boolean))]
    const programMap = new Map<string, string>() // name.lower → id
    if (programNames.length > 0) {
      const programRows = await db.select({ id: programs.id, name: programs.name })
        .from(programs)
        .where(schoolId ? and(eq(programs.schoolId, schoolId)) : undefined as any)
      for (const p of programRows) {
        programMap.set(p.name.toLowerCase(), p.id)
      }
    }

    // ── Step 1: Upsert into chapters + concepts (existing flow) ─────────────
    const chapterResultsMap = new Map<string, { succeeded: number; failed: number }>()
    const chapterIds        = new Map<string, string>() // chapterName.lower → chapterId

    for (const row of rows) {
      if (!row.chapterName) continue
      const nameKey = row.chapterName.trim().toLowerCase()

      // Find or create chapter
      const existing = await db.select({ id: chapters.id })
        .from(chapters)
        .where(and(
          eq(chapters.subjectId, subjectId),
          ilike(chapters.name, row.chapterName.trim()),
          schoolId ? eq(chapters.schoolId, schoolId) : undefined as any,
        ))
        .limit(1)

      if (existing.length > 0) {
        chapterIds.set(nameKey, existing[0].id)
      } else {
        try {
          const programId = row.program ? (programMap.get(row.program.trim().toLowerCase()) ?? null) : null
          const [newChapter] = await db.insert(chapters).values({
            subjectId,
            name:          row.chapterName.trim(),
            code:          row.chapterCode?.trim() ?? '',
            board:         row.board || null,
            classLevel:    row.classLevel || null,
            programId,
            expectedHours: row.expectedHours ? Number(row.expectedHours) : null,
            schoolId,
          }).returning({ id: chapters.id })
          chapterIds.set(nameKey, newChapter.id)
        } catch {
          // Chapter already exists (race condition) — fetch it
          const [ch] = await db.select({ id: chapters.id })
            .from(chapters)
            .where(and(
              eq(chapters.subjectId, subjectId),
              ilike(chapters.name, row.chapterName.trim()),
              schoolId ? eq(chapters.schoolId, schoolId) : undefined as any,
            ))
            .limit(1)
          if (ch) chapterIds.set(nameKey, ch.id)
        }
      }
    }

    // Upsert concepts
    let conceptsSucceeded = 0
    let conceptsFailed    = 0
    const conceptErrors: { row: string; level: string; message: string }[] = []

    for (const row of rows) {
      if (!row.chapterName || !row.conceptName) continue
      const chapterId = chapterIds.get(row.chapterName.trim().toLowerCase())
      if (!chapterId) { conceptsFailed++; continue }

      try {
        const [existing] = await db.select({ id: concepts.id })
          .from(concepts)
          .where(and(eq(concepts.chapterId, chapterId), ilike(concepts.name, row.conceptName.trim())))
          .limit(1)

        if (!existing) {
          await db.insert(concepts).values({
            chapterId,
            name:    row.conceptName.trim(),
            code:    row.conceptCode?.trim() ?? '',
            schoolId,
          })
        }
        conceptsSucceeded++
      } catch (err: any) {
        conceptsFailed++
        conceptErrors.push({ row: row.conceptName, level: 'concept', message: err.message })
      }
    }

    // ── Step 2: Dual-write into master_curriculum ───────────────────────────
    const mcRows: MasterCurriculumImportRow[] = rows
      .filter(r => r.chapterName && r.conceptName)
      .map(r => ({
        board:        r.board      || '',
        program:      r.program    || '',
        classLevel:   r.classLevel || '',
        subject:      subjectName,
        chapterName:  r.chapterName.trim(),
        chapterCode:  r.chapterCode?.trim() ?? '',
        expectedHours: r.expectedHours ? Number(r.expectedHours) : 0,
        conceptName:  r.conceptName.trim(),
        conceptCode:  r.conceptCode?.trim() ?? '',
      }))

    const mcResult = await upsertMasterCurriculumRows(mcRows, schoolId)

    const chaptersSucceeded = chapterIds.size
    const chaptersFailed    = 0

    return NextResponse.json({
      chapters: { succeeded: chaptersSucceeded, failed: chaptersFailed, total: chaptersSucceeded + chaptersFailed },
      concepts: { succeeded: conceptsSucceeded, failed: conceptsFailed, total: conceptsSucceeded + conceptsFailed },
      masterCurriculum: { inserted: mcResult.inserted, errors: mcResult.errors },
      errors: conceptErrors,
    })
  } catch (error: any) {
    console.error('master-curriculum bulk-import POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
