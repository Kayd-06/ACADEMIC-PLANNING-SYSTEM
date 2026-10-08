import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { subjects, programs } from '@/lib/db/schema'
import { and, eq, isNull, or } from 'drizzle-orm'
import { upsertMasterCurriculumRows, type MasterCurriculumImportRow } from '@/lib/db/queries/master-curriculum'
import { importChaptersAndConcepts, type CurriculumImportRow } from '@/lib/curriculum/bulkImport'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RawRow = CurriculumImportRow & { chapterName: string }

// POST — bulk import chapters and their concepts from one flattened CSV/Excel
// sheet (one row per concept, chapter columns repeated across a chapter's
// rows), scoped to one subject (management only). Chapters are grouped and
// upserted first — by name within the subject — so every row referencing the
// same chapter name resolves to a single chapter; concepts are then upserted
// under their resolved chapter, matched by name within that chapter. A
// chapter-only row (no concept columns) is valid and just creates/updates
// the chapter.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can import curriculum data' }, { status: 403 })
    }

    const body = await req.json()
    const { subjectId, rows } = body as { subjectId: string; rows: RawRow[] }
    if (!subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No curriculum data provided' }, { status: 400 })
    }
    // Chapters are always created in the session's school.
    const schoolId = requireSchool(session)

    // The subject must be this school's (or a shared one).
    const [subjectRow] = await db.select({ name: subjects.name }).from(subjects)
      .where(and(eq(subjects.id, subjectId), or(eq(subjects.schoolId, schoolId), isNull(subjects.schoolId))))
    if (!subjectRow) return NextResponse.json({ error: 'Subject not found' }, { status: 404 })

    // Programs are matched by name (case-insensitive) within the caller's school.
    const schoolPrograms = await db.select({ id: programs.id, name: programs.name }).from(programs).where(eq(programs.schoolId, schoolId))
    const programIdByName = new Map(schoolPrograms.map((p) => [p.name.trim().toLowerCase(), p.id]))

    const result = await importChaptersAndConcepts({
      subjectId, schoolId, rows, programIdByName, updateExisting: true, strictProgram: true,
    })
    if (result.errors.length > 0) console.error('Curriculum bulk import failures:', result.errors.length)

    // ── Dual-write into master_curriculum (non-fatal) ─────────────────────
    let mcResult: { inserted: number; updated: number; errors: { row: string; message: string }[] } =
      { inserted: 0, updated: 0, errors: [] }
    try {
      const mcRows: MasterCurriculumImportRow[] = rows
        .filter(r => r.chapterName?.trim() && r.conceptName?.trim())
        .map(r => ({
          board:        r.board?.trim()         ?? '',
          program:      r.program?.trim()       ?? '',
          classLevel:   r.classLevel?.trim()    ?? '',
          subject:      subjectRow.name,
          chapterName:  r.chapterName.trim(),
          chapterCode:  r.chapterCode?.trim()   ?? '',
          expectedHours: r.expectedHours ? Number(r.expectedHours) : 0,
          conceptName:  r.conceptName!.trim(),
          conceptCode:  r.conceptCode?.trim()   ?? '',
        }))
      mcResult = await upsertMasterCurriculumRows(mcRows, schoolId)
    } catch (err) {
      console.error('master_curriculum dual-write error (non-fatal):', err)
      mcResult.errors.push({ row: 'bulk', message: 'Master curriculum could not be updated' })
    }

    return NextResponse.json({
      chapters: result.chapters,
      concepts: result.concepts,
      masterCurriculum: { inserted: mcResult.inserted, errors: mcResult.errors },
      errors: result.errors,
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/curriculum/bulk-import')
  }
}
