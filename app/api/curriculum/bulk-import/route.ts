import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chapters, concepts, type NewChapter, type NewConcept } from '@/lib/db/schema'
import { eq, and, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface RawRow {
  chapterName: string
  chapterCode?: string
  board?: string
  expectedHours?: string
  conceptName?: string
  conceptCode?: string
}

interface ImportError {
  row: string
  level: 'chapter' | 'concept'
  message: string
}

interface ChapterGroup {
  name: string
  code: string
  board: string
  expectedHours: string
  rowLabel: string
}

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
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { subjectId, rows } = body as { subjectId: string; rows: RawRow[] }
    if (!subjectId) return NextResponse.json({ error: 'subjectId is required' }, { status: 400 })
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No curriculum data provided' }, { status: 400 })
    }

    const errors: ImportError[] = []

    // Pass 1 — group rows into unique chapters by name (case-insensitive),
    // merging in code/board/expectedHours from whichever row first supplies
    // a non-empty value.
    const chapterGroups = new Map<string, ChapterGroup>()
    rows.forEach((r, i) => {
      const name = r.chapterName?.trim() || ''
      if (!name) {
        errors.push({ row: `Row ${i + 1}`, level: 'chapter', message: 'Chapter Name is required' })
        return
      }
      const key = name.toLowerCase()
      const code = r.chapterCode?.trim() || ''
      const board = r.board?.trim() || ''
      const expectedHours = r.expectedHours?.trim() || ''
      const existing = chapterGroups.get(key)
      if (!existing) {
        chapterGroups.set(key, { name, code, board, expectedHours, rowLabel: `Row ${i + 1}` })
      } else {
        if (!existing.code && code) existing.code = code
        if (!existing.board && board) existing.board = board
        if (!existing.expectedHours && expectedHours) existing.expectedHours = expectedHours
      }
    })

    // Pass 2 — upsert each unique chapter, matched by name within the subject.
    const chapterIdByName = new Map<string, string>()
    const chapterResults = await Promise.allSettled(
      Array.from(chapterGroups.values()).map(async (group) => {
        const hours = group.expectedHours ? Number(group.expectedHours) : null
        const data: Partial<NewChapter> = {
          name: group.name,
          code: group.code,
          board: group.board || null,
          expectedHours: hours !== null && !Number.isNaN(hours) ? hours : null,
        }
        const matchCondition = schoolId
          ? and(eq(chapters.subjectId, subjectId), ilike(chapters.name, group.name), eq(chapters.schoolId, schoolId))
          : and(eq(chapters.subjectId, subjectId), ilike(chapters.name, group.name))
        const [existingRow] = await db.select().from(chapters).where(matchCondition)

        const chapter = existingRow
          ? (await db.update(chapters).set(data).where(eq(chapters.id, existingRow.id)).returning())[0]
          : (await db.insert(chapters).values({ ...data, name: group.name, subjectId, schoolId } as NewChapter).returning())[0]

        chapterIdByName.set(group.name.toLowerCase(), chapter.id)
        return chapter
      })
    )
    chapterResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        const group = Array.from(chapterGroups.values())[i]
        errors.push({ row: group.rowLabel, level: 'chapter', message: r.reason?.message || String(r.reason) })
      }
    })

    // Pass 3 — upsert concepts under their resolved chapter, matched by name
    // within that chapter. Rows with no concept name are chapter-only rows.
    const conceptRowsWithIndex = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.chapterName?.trim() && r.conceptName?.trim())

    const conceptResults = await Promise.allSettled(
      conceptRowsWithIndex.map(async ({ r }) => {
        const chapterId = chapterIdByName.get(r.chapterName.trim().toLowerCase())
        if (!chapterId) {
          throw new Error(`Skipped — chapter "${r.chapterName.trim()}" failed to import`)
        }
        const name = r.conceptName!.trim()
        const code = r.conceptCode?.trim() || ''
        const matchCondition = schoolId
          ? and(eq(concepts.chapterId, chapterId), ilike(concepts.name, name), eq(concepts.schoolId, schoolId))
          : and(eq(concepts.chapterId, chapterId), ilike(concepts.name, name))
        const [existingRow] = await db.select().from(concepts).where(matchCondition)

        if (existingRow) {
          return (await db.update(concepts).set({ code }).where(eq(concepts.id, existingRow.id)).returning())[0]
        }
        return (await db.insert(concepts).values({ name, code, chapterId, schoolId } as NewConcept).returning())[0]
      })
    )
    conceptResults.forEach((r, idx) => {
      if (r.status === 'rejected') {
        const { i } = conceptRowsWithIndex[idx]
        errors.push({ row: `Row ${i + 1}`, level: 'concept', message: r.reason?.message || String(r.reason) })
      }
    })

    const chaptersSucceeded = chapterResults.filter((r) => r.status === 'fulfilled').length
    const conceptsSucceeded = conceptResults.filter((r) => r.status === 'fulfilled').length

    if (errors.length > 0) {
      console.error('Curriculum bulk import failures:', errors)
    }

    return NextResponse.json({
      chapters: { succeeded: chaptersSucceeded, failed: chapterGroups.size - chaptersSucceeded, total: chapterGroups.size },
      concepts: { succeeded: conceptsSucceeded, failed: conceptRowsWithIndex.length - conceptsSucceeded, total: conceptRowsWithIndex.length },
      errors,
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
