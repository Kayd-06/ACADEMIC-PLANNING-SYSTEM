import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { batches, batchSyllabus, chapters, subjects, schools, programs } from '@/lib/db/schema'
import { eq, and, or, isNull, ilike, asc, inArray, max } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { getAdminSchools } from '@/lib/db/queries/adminSchools'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'

export const dynamic = 'force-dynamic'
// Large Excel imports can take a while; give the function room instead of
// letting Vercel kill it halfway through.
export const maxDuration = 60

const IMPORT_CHUNK_SIZE = 100
const IMPORT_CONCURRENCY = 3

// Chapters that exist for a batch's subject but don't have a batch_syllabus
// row yet are returned with a "pending" id. The row is created the first
// time someone actually changes it (PATCH) — GET never writes.
const PENDING_PREFIX = 'pending:'
const pendingId = (batchId: string, chapterId: string) => `${PENDING_PREFIX}${batchId}:${chapterId}`

function normalizeStatus(status: unknown, fallback = 'Not Started') {
  return status === 'NOT STARTED' ? 'Not Started'
    : status === 'IN PROGRESS' ? 'In Progress'
    : status === 'COMPLETED' ? 'Completed'
    : fallback
}

function splitDates(dates: unknown): { start: string | null; end: string | null } {
  const parts = String(dates || '').split(' - ')
  return { start: parts[0] || null, end: parts[1] || null }
}

function formatDates(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`
  return start || end || ''
}

// Resolves an Excel row's free-text School name to a school this session is
// actually allowed to write to (all schools a management user administers, or
// just a teacher's own active school), never any school in the database. An
// unrecognized/typo'd name is reported as an error instead of silently
// writing into whichever school happens to be selected.
function makeSchoolResolver(session: any, activeSchoolId: string) {
  const cache = new Map<string, string | null>()
  let adminSchoolsPromise: Promise<Array<{ id: string; name: string }>> | null = null
  return async (name: string): Promise<string | null> => {
    const key = name.trim().toLowerCase()
    if (!key) return null
    if (cache.has(key)) return cache.get(key)!
    let resolved: string | null = null
    if ((session.user as any).role === 'management') {
      adminSchoolsPromise ??= getAdminSchools(session.user.id!)
      const accessible = await adminSchoolsPromise
      resolved = accessible.find(s => s.name.trim().toLowerCase() === key)?.id ?? null
    } else {
      const [own] = await db.select({ id: schools.id }).from(schools)
        .where(and(eq(schools.id, activeSchoolId), ilike(schools.name, name.trim())))
      resolved = own?.id ?? null
    }
    cache.set(key, resolved)
    return resolved
  }
}

// Get-or-create helpers used ONLY by write paths (POST).
// Batches have a real unique key (batches_school_name_unique), so creation is
// race-free. Subjects/programs have no unique key in the schema; they are
// resolved once per request (not once per row) to keep the race window tiny.
async function getOrCreateBatch(schoolId: string, name: string, programId?: string) {
  const [existing] = await db.select().from(batches).where(and(eq(batches.schoolId, schoolId), eq(batches.name, name))).limit(1)
  if (existing) return existing
  await db.insert(batches)
    .values({ name, capacity: 60, classLevel: '11', schoolId, programId })
    .onConflictDoNothing({ target: [batches.schoolId, batches.name] })
  const [row] = await db.select().from(batches).where(and(eq(batches.schoolId, schoolId), eq(batches.name, name))).limit(1)
  return row
}

async function getOrCreateSubject(schoolId: string, name: string) {
  const [existing] = await db.select().from(subjects).where(and(eq(subjects.name, name), eq(subjects.schoolId, schoolId))).limit(1)
  if (existing) return existing
  const [created] = await db.insert(subjects).values({ name, code: name.substring(0, 3).toUpperCase(), schoolId }).returning()
  return created
}

async function getOrCreateProgram(schoolId: string, name: string) {
  const [existing] = await db.select().from(programs).where(and(ilike(programs.name, name), eq(programs.schoolId, schoolId))).limit(1)
  if (existing) return existing
  const [created] = await db.insert(programs).values({ name, schoolId }).returning()
  return created
}

async function nextOrderIndex(schoolId: string, subjectId: string) {
  const [row] = await db.select({ value: max(chapters.orderIndex) }).from(chapters)
    .where(and(eq(chapters.subjectId, subjectId), eq(chapters.schoolId, schoolId)))
  return (row?.value ?? 0) + 1
}

// GET — read-only. Missing batch/subject => empty list (it used to CREATE
// the batch, the subject and syllabus rows on every page view, racing with
// concurrent views and producing duplicates).
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const className = searchParams.get('class')
    const subjectParam = searchParams.get('subject')
    const subjectName = subjectParam || 'Physics'
    if (!className) return NextResponse.json([])
    const schoolId = requireSchool(session)
    const isAll = !!subjectParam && subjectParam.toLowerCase() === 'all'

    const [batchRow] = await db.select().from(batches)
      .where(and(eq(batches.name, className), eq(batches.schoolId, schoolId))).limit(1)
    if (!batchRow) return NextResponse.json({ chapters: [], totalChapters: isAll ? 0 : 24 })

    // Chapters must belong to this batch or be shared (batchId NULL, e.g.
    // Curriculum Manager content) — never another batch's chapters.
    const batchScope = or(isNull(chapters.batchId), eq(chapters.batchId, batchRow.id))

    if (isAll) {
      const dbResult = await db
        .select({
          syllabusId: batchSyllabus.id,
          title: chapters.name,
          subjectName: subjects.name,
          estHours: chapters.expectedHours,
          targetStartDate: batchSyllabus.targetStartDate,
          targetEndDate: batchSyllabus.targetEndDate,
          status: batchSyllabus.status,
          notes: chapters.description,
          order: chapters.orderIndex,
        })
        .from(batchSyllabus)
        .innerJoin(chapters, eq(batchSyllabus.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(and(eq(batchSyllabus.batchId, batchRow.id), eq(chapters.schoolId, schoolId), batchScope))
        .orderBy(asc(subjects.name), asc(chapters.orderIndex))

      const formatted = dbResult.map(c => ({
        _id: c.syllabusId,
        title: c.title,
        subject: c.subjectName,
        estHours: c.estHours ? `${c.estHours} hrs est.` : '10 hrs est.',
        dates: formatDates(c.targetStartDate, c.targetEndDate),
        status: (c.status || 'Not Started').toUpperCase(),
        notes: c.notes || '',
        order: c.order || 0,
      }))
      return NextResponse.json({ chapters: formatted, totalChapters: formatted.length })
    }

    const [subjectRow] = await db.select().from(subjects)
      .where(and(eq(subjects.name, subjectName), eq(subjects.schoolId, schoolId))).limit(1)
    if (!subjectRow) return NextResponse.json({ chapters: [], totalChapters: 24 })

    // LEFT JOIN: chapters without a syllabus row for this batch still show up
    // (as "Not Started", with a pending id) without writing anything.
    const dbResult = await db
      .select({
        syllabusId: batchSyllabus.id,
        chapterId: chapters.id,
        title: chapters.name,
        estHours: chapters.expectedHours,
        targetStartDate: batchSyllabus.targetStartDate,
        targetEndDate: batchSyllabus.targetEndDate,
        status: batchSyllabus.status,
        notes: chapters.description,
        order: chapters.orderIndex,
      })
      .from(chapters)
      .leftJoin(batchSyllabus, and(eq(batchSyllabus.chapterId, chapters.id), eq(batchSyllabus.batchId, batchRow.id)))
      .where(and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, schoolId), batchScope))
      .orderBy(asc(chapters.orderIndex))

    const formatted = dbResult.map(c => ({
      _id: c.syllabusId ?? pendingId(batchRow.id, c.chapterId),
      title: c.title,
      estHours: c.estHours ? `${c.estHours} hrs est.` : '10 hrs est.',
      dates: formatDates(c.targetStartDate, c.targetEndDate),
      status: (c.status || 'Not Started').toUpperCase(),
      notes: c.notes || '',
      order: c.order || 0,
    }))

    return NextResponse.json({ chapters: formatted, totalChapters: Math.max(24, formatted.length) })
  } catch (error) {
    return errorResponse(error, 'GET /api/teacher-portal/academic-planning/chapters')
  }
}

// A batchSyllabus row's own school is reached only through its batch — used
// by PATCH/DELETE to confirm the caller's school actually owns the row
// before mutating it. A "pending" id (chapter shown without a syllabus row)
// is materialized here, on the write path, race-free thanks to the
// batch_syllabus_batch_chapter_unique index (migration 0051).
async function loadAuthorizedSyllabusRow(id: string, schoolId: string, createIfPending: boolean) {
  if (id.startsWith(PENDING_PREFIX)) {
    const [batchId, chapterId] = id.slice(PENDING_PREFIX.length).split(':')
    if (!batchId || !chapterId) return null
    const [batchRow] = await db.select({ id: batches.id }).from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.schoolId, schoolId)))
    const [chapterRow] = await db.select({ id: chapters.id }).from(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.schoolId, schoolId), or(isNull(chapters.batchId), eq(chapters.batchId, batchId))))
    if (!batchRow || !chapterRow) return null
    if (createIfPending) {
      await db.insert(batchSyllabus).values({ batchId, chapterId, status: 'Not Started' })
        .onConflictDoNothing({ target: [batchSyllabus.batchId, batchSyllabus.chapterId] })
    }
    const [row] = await db.select().from(batchSyllabus)
      .where(and(eq(batchSyllabus.batchId, batchId), eq(batchSyllabus.chapterId, chapterId))).limit(1)
    return row ?? { id: null, batchId, chapterId }
  }

  const [row] = await db
    .select({ syllabus: batchSyllabus })
    .from(batchSyllabus)
    .innerJoin(batches, eq(batchSyllabus.batchId, batches.id))
    .where(and(eq(batchSyllabus.id, id), eq(batches.schoolId, schoolId)))
    .limit(1)
  return row?.syllabus ?? null
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, status, notes, title, estHours, dates } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing chapter/syllabus ID' }, { status: 400 })
    const schoolId = requireSchool(session)

    const sb = await loadAuthorizedSyllabusRow(String(id), schoolId, true)
    if (!sb || !sb.id) return NextResponse.json({ error: 'Syllabus record not found' }, { status: 404 })

    const sbUpdates: Partial<typeof batchSyllabus.$inferInsert> = {}
    if (status) {
      const normalizedStatus = normalizeStatus(status, status)
      sbUpdates.status = normalizedStatus
      if (normalizedStatus === 'Completed') {
        sbUpdates.actualEndDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
    }
    if (dates !== undefined) {
      const { start, end } = splitDates(dates)
      sbUpdates.targetStartDate = dates ? start : null
      sbUpdates.targetEndDate = dates ? end : null
    }

    const chapUpdates: Partial<typeof chapters.$inferInsert> = {}
    if (notes !== undefined) chapUpdates.description = notes
    if (title !== undefined) chapUpdates.name = title
    if (estHours !== undefined) chapUpdates.expectedHours = parseInt(estHours) || 10

    // Both updates commit together or not at all.
    const statements = []
    if (Object.keys(sbUpdates).length > 0) {
      statements.push(db.update(batchSyllabus).set({ ...sbUpdates, updatedAt: new Date() }).where(eq(batchSyllabus.id, sb.id)))
    }
    if (Object.keys(chapUpdates).length > 0) {
      statements.push(db.update(chapters).set(chapUpdates).where(and(eq(chapters.id, sb.chapterId), eq(chapters.schoolId, schoolId))))
    }
    if (statements.length > 0) await db.batch(statements as [typeof statements[number], ...typeof statements])

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'PATCH /api/teacher-portal/academic-planning/chapters')
  }
}

interface ImportItem {
  title?: string
  batch?: string
  subject?: string
  school?: string
  program?: string
  estHours?: string | number
  notes?: string
  status?: string
  dates?: string
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await req.json()

    if (Array.isArray(data.items) || Array.isArray(data.chapters)) {
      const itemsToCreate: ImportItem[] = data.items || data.chapters
      const className = data.className || data.batch
      const subject = data.subject
      if (!className || !subject) {
        return NextResponse.json({ error: 'Class and Subject are required for bulk upload' }, { status: 400 })
      }
      // The upload's default school is ALWAYS the session's active school —
      // a client-sent schoolId is ignored. Rows may still name another school
      // the user administers ("Automatic" routing), validated below.
      const activeSchoolId = requireSchool(session)
      return NextResponse.json(await bulkCreateChapters(session, activeSchoolId, className, subject, itemsToCreate))
    }

    // Single creation
    const { className, subject, title, estHours, dates, status, notes } = data
    if (!className || !subject || !title) {
      return NextResponse.json({ error: 'Class, Subject, and Title are required' }, { status: 400 })
    }
    const schoolId = requireSchool(session)

    const batchRow = await getOrCreateBatch(schoolId, className)
    const subjectRow = await getOrCreateSubject(schoolId, subject)
    const chapterId = crypto.randomUUID()
    const { start, end } = splitDates(dates)

    const [[newChap], [newSyllabus]] = await db.batch([
      db.insert(chapters).values({
        id: chapterId,
        subjectId: subjectRow.id,
        batchId: batchRow.id,
        name: title,
        description: notes || '',
        expectedHours: parseInt(estHours) || 10,
        orderIndex: await nextOrderIndex(schoolId, subjectRow.id),
        schoolId,
      }).returning(),
      db.insert(batchSyllabus).values({
        batchId: batchRow.id,
        chapterId,
        targetStartDate: start,
        targetEndDate: end,
        status: normalizeStatus(status),
      }).returning(),
    ])

    return NextResponse.json({
      success: true,
      chapter: {
        _id: newSyllabus.id,
        title: newChap.name,
        estHours: `${newChap.expectedHours} hrs est.`,
        dates: formatDates(newSyllabus.targetStartDate, newSyllabus.targetEndDate),
        status: newSyllabus.status.toUpperCase(),
        notes: newChap.description,
        order: newChap.orderIndex,
      },
    })
  } catch (error) {
    return errorResponse(error, 'POST /api/teacher-portal/academic-planning/chapters')
  }
}

async function bulkCreateChapters(session: any, activeSchoolId: string, className: string, subject: string, items: ImportItem[]) {
  const errors: { title: string; reason: string }[] = []
  const resolveSchool = makeSchoolResolver(session, activeSchoolId)

  // 1) Resolve each row's school (cached per name).
  const planned: Array<{ item: ImportItem; title: string; schoolId: string; batchName: string; subjectName: string }> = []
  for (const item of items) {
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title) continue
    let schoolId = activeSchoolId
    if (item.school && item.school.trim()) {
      const resolved = await resolveSchool(item.school)
      if (!resolved) {
        errors.push({ title, reason: `School "${item.school.trim()}" not found or not accessible` })
        continue
      }
      schoolId = resolved
    }
    planned.push({ item, title, schoolId, batchName: item.batch || className, subjectName: item.subject || subject })
  }

  // 2) Resolve each distinct batch / subject ONCE per import (it used to be
  //    2–5 queries per row, run one row at a time).
  const batchByKey = new Map<string, typeof batches.$inferSelect>()
  const subjectByKey = new Map<string, typeof subjects.$inferSelect>()
  for (const p of planned) {
    const bKey = `${p.schoolId}|${p.batchName}`
    if (!batchByKey.has(bKey)) {
      const existing = await db.select().from(batches)
        .where(and(eq(batches.schoolId, p.schoolId), eq(batches.name, p.batchName))).limit(1)
      if (existing[0]) {
        batchByKey.set(bKey, existing[0])
      } else {
        // A brand-new batch picks up its Program from the Excel row; an
        // existing batch keeps its own program link.
        const programName = p.item.program && p.item.program.trim()
        const programId = programName ? (await getOrCreateProgram(p.schoolId, programName)).id : undefined
        batchByKey.set(bKey, await getOrCreateBatch(p.schoolId, p.batchName, programId))
      }
    }
    const sKey = `${p.schoolId}|${p.subjectName}`
    if (!subjectByKey.has(sKey)) subjectByKey.set(sKey, await getOrCreateSubject(p.schoolId, p.subjectName))
  }

  // 3) Order indexes: one MAX() per (school, subject), then increment in memory.
  const nextOrder = new Map<string, number>()
  const subjectIdsBySchool = new Map<string, Set<string>>()
  for (const s of subjectByKey.values()) {
    if (!s.schoolId) continue
    const set = subjectIdsBySchool.get(s.schoolId) ?? new Set<string>()
    set.add(s.id)
    subjectIdsBySchool.set(s.schoolId, set)
  }
  for (const [schoolId, ids] of subjectIdsBySchool) {
    const rows = await db.select({ subjectId: chapters.subjectId, value: max(chapters.orderIndex) }).from(chapters)
      .where(and(eq(chapters.schoolId, schoolId), inArray(chapters.subjectId, [...ids])))
      .groupBy(chapters.subjectId)
    const found = new Map(rows.map(r => [r.subjectId, r.value ?? 0]))
    for (const id of ids) nextOrder.set(`${schoolId}|${id}`, (found.get(id) ?? 0) + 1)
  }

  const rows = planned.map(p => {
    const batchRow = batchByKey.get(`${p.schoolId}|${p.batchName}`)!
    const subjectRow = subjectByKey.get(`${p.schoolId}|${p.subjectName}`)!
    const orderKey = `${p.schoolId}|${subjectRow.id}`
    const orderIndex = nextOrder.get(orderKey) ?? 1
    nextOrder.set(orderKey, orderIndex + 1)
    const { start, end } = splitDates(p.item.dates)
    const chapterId = crypto.randomUUID()
    return {
      title: p.title,
      batchName: p.batchName,
      subjectName: p.subjectName,
      chapter: {
        id: chapterId,
        subjectId: subjectRow.id,
        batchId: batchRow.id,
        name: p.title,
        description: p.item.notes || '',
        expectedHours: parseInt(String(p.item.estHours ?? '')) || 10,
        orderIndex,
        schoolId: p.schoolId,
      },
      syllabus: {
        batchId: batchRow.id,
        chapterId,
        targetStartDate: start,
        targetEndDate: end,
        status: normalizeStatus(p.item.status),
      },
    }
  })

  // 4) Insert in chunks; each chunk's chapters + syllabus rows commit
  //    atomically, a few chunks at a time.
  const chunks = chunk(rows, IMPORT_CHUNK_SIZE)
  const results = await mapWithConcurrency(chunks, IMPORT_CONCURRENCY, async (part) => {
    const [insertedChapters, insertedSyllabus] = await db.batch([
      db.insert(chapters).values(part.map(r => r.chapter)).returning(),
      db.insert(batchSyllabus).values(part.map(r => r.syllabus)).returning(),
    ])
    return { insertedChapters, insertedSyllabus }
  })

  const createdList: any[] = []
  results.forEach((result, i) => {
    const part = chunks[i]
    if (result.status === 'rejected') {
      console.error('[chapters bulk import] chunk failed', result.reason)
      for (const r of part) errors.push({ title: r.title, reason: 'Could not be saved. Please try again.' })
      return
    }
    const chapterById = new Map(result.value.insertedChapters.map(c => [c.id, c]))
    for (const sb of result.value.insertedSyllabus) {
      const chap = chapterById.get(sb.chapterId)
      const meta = part.find(r => r.chapter.id === sb.chapterId)
      if (!chap || !meta) continue
      createdList.push({
        _id: sb.id,
        title: chap.name,
        estHours: `${chap.expectedHours} hrs est.`,
        dates: formatDates(sb.targetStartDate, sb.targetEndDate),
        status: sb.status.toUpperCase(),
        notes: chap.description,
        order: chap.orderIndex,
        subject: meta.subjectName,
        batch: meta.batchName,
      })
    }
  })

  return { success: true, count: createdList.length, chapters: createdList, errors }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing chapter ID' }, { status: 400 })
    const schoolId = requireSchool(session)

    const sb = await loadAuthorizedSyllabusRow(id, schoolId, false)
    if (!sb) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    await db.delete(chapters).where(and(eq(chapters.id, sb.chapterId), eq(chapters.schoolId, schoolId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/teacher-portal/academic-planning/chapters')
  }
}
