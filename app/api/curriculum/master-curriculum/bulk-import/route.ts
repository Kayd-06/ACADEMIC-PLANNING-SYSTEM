import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { upsertMasterCurriculumRows, type MasterCurriculumImportRow } from '@/lib/db/queries/master-curriculum'
import { db } from '@/lib/db'
import { subjects, programs } from '@/lib/db/schema'
import { and, eq, isNull, or } from 'drizzle-orm'
import { importChaptersAndConcepts } from '@/lib/curriculum/bulkImport'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST — dual-write bulk import:
//   1. Upserts into chapters + concepts (backward compatible, existing flow;
//      existing chapters/concepts are left as they are)
//   2. Upserts into master_curriculum (new denormalized table)
//
// Body: { subjectId: string, rows: ParsedRow[] }
// where ParsedRow = { board, program, classLevel, chapterName, chapterCode, expectedHours, conceptName, conceptCode }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = requireSchool(session)

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

    // ── Resolve subject name for master_curriculum (this school's or shared) ─
    const [subjectRow] = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), or(eq(subjects.schoolId, schoolId), isNull(subjects.schoolId))))

    if (!subjectRow) return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    const subjectName = subjectRow.name

    // ── Resolve program names to IDs (for chapter FK), this school only ────
    const programRows = await db.select({ id: programs.id, name: programs.name })
      .from(programs)
      .where(eq(programs.schoolId, schoolId))
    const programMap = new Map(programRows.map(p => [p.name.trim().toLowerCase(), p.id]))

    // ── Step 1: chapters + concepts (prefetch + chunked writes) ─────────────
    const result = await importChaptersAndConcepts({
      subjectId, schoolId, rows, programIdByName: programMap, updateExisting: false, strictProgram: false,
    })

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

    return NextResponse.json({
      chapters: result.chapters,
      concepts: result.concepts,
      masterCurriculum: { inserted: mcResult.inserted, errors: mcResult.errors },
      errors: result.errors.filter(e => e.level === 'concept'),
    })
  } catch (error) {
    return errorResponse(error, 'POST /api/curriculum/master-curriculum/bulk-import')
  }
}
