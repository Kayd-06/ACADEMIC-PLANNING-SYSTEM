import { eq, and, asc } from 'drizzle-orm'
import { db } from '../index'
import { chapters, concepts, subjects, programs, masterCurriculum, type Chapter, type NewChapter, type Concept, type NewConcept } from '../schema'

export async function listChaptersBySubject(subjectId: string, schoolId?: string | null): Promise<Chapter[]> {
  const conditions: any[] = [eq(chapters.subjectId, subjectId)]
  if (schoolId) conditions.push(eq(chapters.schoolId, schoolId))
  return db
    .select()
    .from(chapters)
    .where(and(...conditions))
    .orderBy(asc(chapters.orderIndex), asc(chapters.name))
}

export async function createChapter(data: NewChapter): Promise<Chapter> {
  const rows = await db.insert(chapters).values(data).returning()
  const chapter = rows[0]
  if (chapter) {
    let subjectName = '', programName = ''
    if (chapter.subjectId) {
      const [s] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, chapter.subjectId))
      if (s) subjectName = s.name
    }
    if (chapter.programId) {
      const [p] = await db.select({ name: programs.name }).from(programs).where(eq(programs.id, chapter.programId))
      if (p) programName = p.name
    }
    await db.insert(masterCurriculum).values({
      schoolId: chapter.schoolId || '00000000-0000-0000-0000-000000000000',
      board: chapter.board || '',
      program: programName,
      classLevel: chapter.classLevel || '',
      subject: subjectName,
      chapterName: chapter.name,
      chapterCode: chapter.code,
      chapterOrderIndex: chapter.orderIndex || 0,
      expectedHours: chapter.expectedHours || 0,
      conceptName: '',
      conceptCode: '',
      conceptOrderIndex: 0
    })
  }
  return chapter
}

export async function updateChapter(id: string, data: Partial<NewChapter>, schoolId?: string | null): Promise<Chapter | null> {
  const condition = schoolId ? and(eq(chapters.id, id), eq(chapters.schoolId, schoolId)) : eq(chapters.id, id)
  const [old] = await db.select().from(chapters).where(condition)
  if (!old) return null
  const rows = await db.update(chapters).set(data).where(condition).returning()
  const chapter = rows[0]
  if (chapter) {
    const updates: any = {}
    if (data.board !== undefined) updates.board = data.board || ''
    if (data.classLevel !== undefined) updates.classLevel = data.classLevel || ''
    if (data.name !== undefined) updates.chapterName = data.name || ''
    if (data.code !== undefined) updates.chapterCode = data.code || ''
    if (data.orderIndex !== undefined) updates.chapterOrderIndex = data.orderIndex || 0
    if (data.expectedHours !== undefined) updates.expectedHours = data.expectedHours || 0
    if (data.subjectId) {
       const [s] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, data.subjectId))
       if (s) updates.subject = s.name
    }
    if (data.programId) {
       const [p] = await db.select({ name: programs.name }).from(programs).where(eq(programs.id, data.programId))
       if (p) updates.program = p.name
    }
    if (Object.keys(updates).length > 0) {
      const mcCond = schoolId ? and(eq(masterCurriculum.chapterCode, old.code), eq(masterCurriculum.schoolId, schoolId)) : eq(masterCurriculum.chapterCode, old.code)
      await db.update(masterCurriculum).set(updates).where(mcCond)
    }
  }
  return chapter ?? null
}

export async function deleteChapter(id: string, schoolId?: string | null): Promise<void> {
  const condition = schoolId ? and(eq(chapters.id, id), eq(chapters.schoolId, schoolId)) : eq(chapters.id, id)
  const [old] = await db.select().from(chapters).where(condition)
  if (old) {
    const mcCond = schoolId ? and(eq(masterCurriculum.chapterCode, old.code), eq(masterCurriculum.schoolId, schoolId)) : eq(masterCurriculum.chapterCode, old.code)
    await db.delete(masterCurriculum).where(mcCond)
  }
  await db.delete(chapters).where(condition)
}

export async function listConceptsByChapter(chapterId: string, schoolId?: string | null): Promise<Concept[]> {
  const conditions: any[] = [eq(concepts.chapterId, chapterId)]
  if (schoolId) conditions.push(eq(concepts.schoolId, schoolId))
  return db
    .select()
    .from(concepts)
    .where(and(...conditions))
    .orderBy(asc(concepts.orderIndex), asc(concepts.name))
}

export async function createConcept(data: NewConcept): Promise<Concept> {
  const rows = await db.insert(concepts).values(data).returning()
  const concept = rows[0]
  if (concept) {
    const condition = concept.schoolId ? and(eq(chapters.id, concept.chapterId), eq(chapters.schoolId, concept.schoolId)) : eq(chapters.id, concept.chapterId)
    const [chapter] = await db.select().from(chapters).where(condition)
    if (chapter) {
      let subjectName = '', programName = ''
      if (chapter.subjectId) {
        const [s] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, chapter.subjectId))
        if (s) subjectName = s.name
      }
      if (chapter.programId) {
        const [p] = await db.select({ name: programs.name }).from(programs).where(eq(programs.id, chapter.programId))
        if (p) programName = p.name
      }
      const emptyCond = and(eq(masterCurriculum.chapterCode, chapter.code), eq(masterCurriculum.conceptCode, ''))
      await db.delete(masterCurriculum).where(emptyCond)
      await db.insert(masterCurriculum).values({
        schoolId: concept.schoolId || chapter.schoolId || '00000000-0000-0000-0000-000000000000',
        board: chapter.board || '',
        program: programName,
        classLevel: chapter.classLevel || '',
        subject: subjectName,
        chapterName: chapter.name,
        chapterCode: chapter.code,
        chapterOrderIndex: chapter.orderIndex || 0,
        expectedHours: chapter.expectedHours || 0,
        conceptName: concept.name,
        conceptCode: concept.code,
        conceptOrderIndex: concept.orderIndex || 0
      })
    }
  }
  return concept
}

export async function updateConcept(id: string, data: Partial<NewConcept>, schoolId?: string | null): Promise<Concept | null> {
  const condition = schoolId ? and(eq(concepts.id, id), eq(concepts.schoolId, schoolId)) : eq(concepts.id, id)
  const [old] = await db.select().from(concepts).where(condition)
  if (!old) return null
  const rows = await db.update(concepts).set(data).where(condition).returning()
  const concept = rows[0]
  if (concept) {
    const updates: any = {}
    if (data.name !== undefined) updates.conceptName = data.name || ''
    if (data.code !== undefined) updates.conceptCode = data.code || ''
    if (data.orderIndex !== undefined) updates.conceptOrderIndex = data.orderIndex || 0
    if (Object.keys(updates).length > 0) {
      const mcCond = schoolId ? and(eq(masterCurriculum.conceptCode, old.code), eq(masterCurriculum.schoolId, schoolId)) : eq(masterCurriculum.conceptCode, old.code)
      await db.update(masterCurriculum).set(updates).where(mcCond)
    }
  }
  return concept ?? null
}

export async function deleteConcept(id: string, schoolId?: string | null): Promise<void> {
  const condition = schoolId ? and(eq(concepts.id, id), eq(concepts.schoolId, schoolId)) : eq(concepts.id, id)
  const [old] = await db.select().from(concepts).where(condition)
  if (old) {
    const mcCond = schoolId ? and(eq(masterCurriculum.conceptCode, old.code), eq(masterCurriculum.schoolId, schoolId)) : eq(masterCurriculum.conceptCode, old.code)
    await db.delete(masterCurriculum).where(mcCond)
  }
  await db.delete(concepts).where(condition)
}

// ── Master Sheet ─────────────────────────────────────────────────────────────
// Flat 8-column join matching the Excel Master Sheet field alignment spec:
//   Board | Program | Class | Subject | Chapter Name | Chapter Code | Concept Name | Concept Code

export interface MasterSheetRow {
  chapterId: string
  conceptId: string | null
  board: string | null
  program: string | null
  classLevel: string | null
  subject: string
  chapterName: string
  chapterCode: string
  conceptName: string | null
  conceptCode: string | null
}

export interface MasterSheetFilters {
  board?: string | null
  classLevel?: string | null
  programId?: string | null
  subjectId?: string | null
}

export async function listMasterSheetRows(
  filters: MasterSheetFilters = {},
  schoolId?: string | null,
): Promise<MasterSheetRow[]> {
  const { masterCurriculum } = await import('../schema')

  // Check if master_curriculum has data for this school
  const mcCondition = schoolId ? eq(masterCurriculum.schoolId, schoolId) : undefined
  const [mcExists] = await db.select({ id: masterCurriculum.id }).from(masterCurriculum).where(mcCondition).limit(1)

  if (mcExists) {
    // We have data in the new table — use it!
    // We need to resolve subjectId and programId to names since the flat table only stores names
    let subjectName: string | undefined
    let programName: string | undefined

    if (filters.subjectId) {
      const [s] = await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, filters.subjectId))
      if (s) subjectName = s.name
    }
    if (filters.programId) {
      const [p] = await db.select({ name: programs.name }).from(programs).where(eq(programs.id, filters.programId))
      if (p) programName = p.name
    }

    const mcConditions: any[] = []
    if (schoolId) mcConditions.push(eq(masterCurriculum.schoolId, schoolId))
    if (filters.board) mcConditions.push(eq(masterCurriculum.board, filters.board))
    if (filters.classLevel) mcConditions.push(eq(masterCurriculum.classLevel, filters.classLevel))
    if (subjectName) mcConditions.push(eq(masterCurriculum.subject, subjectName))
    if (programName) mcConditions.push(eq(masterCurriculum.program, programName))

    const mcWhere = mcConditions.length > 0 ? and(...mcConditions) : undefined

    const mcRows = await db
      .select()
      .from(masterCurriculum)
      .where(mcWhere)
      .orderBy(
        asc(masterCurriculum.subject),
        asc(masterCurriculum.program),
        asc(masterCurriculum.classLevel),
        asc(masterCurriculum.chapterOrderIndex),
        asc(masterCurriculum.chapterName),
        asc(masterCurriculum.conceptOrderIndex),
        asc(masterCurriculum.conceptName),
      )

    return mcRows.map(r => ({
      chapterId: r.id, // We map the masterCurriculum ID to chapterId so the UI export still works
      conceptId: r.id,
      board: r.board,
      program: r.program,
      classLevel: r.classLevel,
      subject: r.subject,
      chapterName: r.chapterName,
      chapterCode: r.chapterCode,
      conceptName: r.conceptName,
      conceptCode: r.conceptCode,
    }))
  }

  // ── Fallback (existing JOIN approach) ───────────────────────────────────────
  const conditions: ReturnType<typeof eq>[] = []
  if (schoolId) conditions.push(eq(chapters.schoolId, schoolId))
  if (filters.board) conditions.push(eq(chapters.board, filters.board))
  if (filters.classLevel) conditions.push(eq(chapters.classLevel, filters.classLevel))
  if (filters.programId) conditions.push(eq(chapters.programId, filters.programId))
  if (filters.subjectId) conditions.push(eq(chapters.subjectId, filters.subjectId))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      chapterId: chapters.id,
      conceptId: concepts.id,
      board: chapters.board,
      programName: programs.name,
      classLevel: chapters.classLevel,
      subjectName: subjects.name,
      chapterName: chapters.name,
      chapterCode: chapters.code,
      conceptName: concepts.name,
      conceptCode: concepts.code,
    })
    .from(chapters)
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .leftJoin(programs, eq(chapters.programId, programs.id))
    .leftJoin(concepts, eq(concepts.chapterId, chapters.id))
    .where(where)
    .orderBy(
      asc(subjects.name),
      asc(programs.name),
      asc(chapters.classLevel),
      asc(chapters.orderIndex),
      asc(chapters.name),
      asc(concepts.orderIndex),
      asc(concepts.name),
    )

  return rows.map((r) => ({
    chapterId: r.chapterId,
    conceptId: r.conceptId ?? null,
    board: r.board ?? null,
    program: r.programName ?? null,
    classLevel: r.classLevel ?? null,
    subject: r.subjectName,
    chapterName: r.chapterName,
    chapterCode: r.chapterCode ?? '',
    conceptName: r.conceptName ?? null,
    conceptCode: r.conceptCode ?? null,
  }))
}

