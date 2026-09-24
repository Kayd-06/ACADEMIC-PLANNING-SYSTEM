import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { batches, batchSyllabus, chapters, subjects, schools, programs } from '@/lib/db/schema'
import { eq, and, or, isNull, ilike, asc, desc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'
import { getAdminSchools } from '@/lib/db/queries/adminSchools'

// Resolves an Excel row's free-text School name to a school this session is
// actually allowed to write to -- scoped the same way the rest of the app
// scopes school access (all schools a management user administers, or just
// a teacher's own active school), never any school in the database. Used by
// the bulk import's "Automatic" school routing so an unrecognized/typo'd
// school name is reported as an error instead of silently writing into
// whichever school happens to be selected in the upload dropdown.
async function resolveItemSchoolId(session: any, name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  if ((session.user as any).role === 'management') {
    const accessible = await getAdminSchools(session.user.id!)
    const match = accessible.find(s => s.name.trim().toLowerCase() === trimmed.toLowerCase())
    return match ? match.id : null
  }

  const sessionSchoolId = getSchoolId(session)
  if (!sessionSchoolId) return null
  const [own] = await db.select({ id: schools.id }).from(schools).where(and(eq(schools.id, sessionSchoolId), ilike(schools.name, trimmed)))
  return own ? own.id : null
}

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const { searchParams } = new URL(req.url)
    const className = searchParams.get('class')
    const subjectParam = searchParams.get('subject')
    const subjectName = subjectParam || 'Physics'
    if (!className) return NextResponse.json([])

    // 1. Get or create Batch, scoped to this school — batch names are not
    // globally unique, so matching on name alone would silently merge every
    // school's same-named batch (e.g. "Grade 11-A") into one shared row.
    const batchCond = schoolId ? and(eq(batches.name, className), eq(batches.schoolId, schoolId)) : eq(batches.name, className)
    let batchRow = await db.select().from(batches).where(batchCond).limit(1).then(r => r[0])
    if (!batchRow) {
      const [newBatch] = await db.insert(batches).values({
        name: className,
        capacity: 60,
        classLevel: '11',
        schoolId,
      }).returning()
      batchRow = newBatch
    }

    // Support subject=all to get all chapters across all subjects for a batch
    if (subjectParam && subjectParam.toLowerCase() === 'all') {
      // Chapters must belong to this batch or be shared (batchId NULL, e.g.
      // Curriculum Manager content) — never another batch's chapters.
      const batchScope = or(isNull(chapters.batchId), eq(chapters.batchId, batchRow.id))
      const joinCond = schoolId ? and(eq(batchSyllabus.batchId, batchRow.id), eq(chapters.schoolId, schoolId), batchScope) : and(eq(batchSyllabus.batchId, batchRow.id), batchScope)
      const dbResult = await db
        .select({
          syllabusId: batchSyllabus.id,
          chapterId: chapters.id,
          title: chapters.name,
          subjectName: subjects.name,
          estHours: chapters.expectedHours,
          targetStartDate: batchSyllabus.targetStartDate,
          targetEndDate: batchSyllabus.targetEndDate,
          status: batchSyllabus.status,
          notes: chapters.description,
          order: chapters.orderIndex
        })
        .from(batchSyllabus)
        .innerJoin(chapters, eq(batchSyllabus.chapterId, chapters.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .where(joinCond)
        .orderBy(asc(subjects.name), asc(chapters.orderIndex))

      const formatted = dbResult.map(c => {
        let datesStr = ''
        if (c.targetStartDate && c.targetEndDate) {
          datesStr = `${c.targetStartDate} - ${c.targetEndDate}`
        } else if (c.targetStartDate || c.targetEndDate) {
          datesStr = c.targetStartDate || c.targetEndDate || ''
        }
        return {
          _id: c.syllabusId,
          title: c.title,
          subject: c.subjectName,
          estHours: c.estHours ? `${c.estHours} hrs est.` : '10 hrs est.',
          dates: datesStr,
          status: (c.status || 'Not Started').toUpperCase(),
          notes: c.notes || '',
          order: c.order || 0
        }
      })

      return NextResponse.json({
        chapters: formatted,
        totalChapters: formatted.length
      })
    }

    // 2. Get or create Subject, scoped to this school for the same reason.
    const subjectCond = schoolId ? and(eq(subjects.name, subjectName), eq(subjects.schoolId, schoolId)) : eq(subjects.name, subjectName)
    let subjectRow = await db.select().from(subjects).where(subjectCond).limit(1).then(r => r[0])
    if (!subjectRow) {
      const [newSub] = await db.insert(subjects).values({
        name: subjectName,
        code: subjectName.substring(0, 3).toUpperCase(),
        description: `${subjectName} subject`,
        schoolId,
      }).returning()
      subjectRow = newSub
    }

    // 3. Get chapters, scoped to this school and to this batch (or shared/
    // NULL-batch chapters, e.g. Curriculum Manager content) — never another
    // batch's chapters, which is what let a NEET 1 chapter leak into a JEE 1
    // view of the same subject before batchId existed.
    const batchScope = or(isNull(chapters.batchId), eq(chapters.batchId, batchRow.id))
    const chapterCond = schoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, schoolId), batchScope) : and(eq(chapters.subjectId, subjectRow.id), batchScope)
    let chapterRows = await db.select().from(chapters).where(chapterCond).orderBy(asc(chapters.orderIndex))

    // 4. Get or create batchSyllabus entries for existing chapters
    if (chapterRows.length > 0) {
      const existingSyllabus = await db.select().from(batchSyllabus).where(eq(batchSyllabus.batchId, batchRow.id))
      const existingChapterIds = new Set(existingSyllabus.map(s => s.chapterId))

      const missingChapters = chapterRows.filter(c => !existingChapterIds.has(c.id))
      if (missingChapters.length > 0) {
        const seedSyllabus = missingChapters.map(c => ({
          batchId: batchRow!.id,
          chapterId: c.id,
          targetStartDate: null,
          targetEndDate: null,
          status: 'Not Started'
        }))
        await db.insert(batchSyllabus).values(seedSyllabus)
      }
    }

    // 6. Query joined result, scoped to this school's chapters and this
    // batch (or shared/NULL-batch chapters) only.
    const joinChapterCond = schoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, schoolId), batchScope) : and(eq(chapters.subjectId, subjectRow.id), batchScope)
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
        order: chapters.orderIndex
      })
      .from(batchSyllabus)
      .innerJoin(chapters, eq(batchSyllabus.chapterId, chapters.id))
      .where(and(eq(batchSyllabus.batchId, batchRow.id), joinChapterCond))
      .orderBy(asc(chapters.orderIndex))

    // Format for React UI
    const formatted = dbResult.map(c => {
      let datesStr = ''
      if (c.targetStartDate && c.targetEndDate) {
        datesStr = `${c.targetStartDate} - ${c.targetEndDate}`
      } else if (c.targetStartDate || c.targetEndDate) {
        datesStr = c.targetStartDate || c.targetEndDate || ''
      }
      return {
        _id: c.syllabusId,
        title: c.title,
        estHours: c.estHours ? `${c.estHours} hrs est.` : '10 hrs est.',
        dates: datesStr,
        status: (c.status || 'Not Started').toUpperCase(),
        notes: c.notes || '',
        order: c.order || 0
      }
    })

    return NextResponse.json({
      chapters: formatted,
      totalChapters: Math.max(24, formatted.length)
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// A batchSyllabus row's own school is reached only through its batch — used
// by PATCH/DELETE to confirm the caller's school actually owns the row
// before mutating it.
async function loadAuthorizedSyllabusRow(id: string, schoolId: string | null) {
  const [row] = await db
    .select({ syllabus: batchSyllabus, batchSchoolId: batches.schoolId })
    .from(batchSyllabus)
    .innerJoin(batches, eq(batchSyllabus.batchId, batches.id))
    .where(eq(batchSyllabus.id, id))
    .limit(1)
  if (!row) return null
  if (schoolId && row.batchSchoolId !== schoolId) return null
  return row.syllabus
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const { id, status, notes, title, estHours, dates } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing chapter/syllabus ID' }, { status: 400 })

    const sb = await loadAuthorizedSyllabusRow(id, schoolId)
    if (!sb) return NextResponse.json({ error: 'Syllabus record not found' }, { status: 404 })

    // Update batchSyllabus fields
    const sbUpdates: any = {}
    if (status) {
      const normalizedStatus = status === 'NOT STARTED' ? 'Not Started' :
                               status === 'IN PROGRESS' ? 'In Progress' :
                               status === 'COMPLETED' ? 'Completed' : status
      sbUpdates.status = normalizedStatus
      if (normalizedStatus === 'Completed') {
        sbUpdates.actualEndDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
    }
    if (dates !== undefined) {
      if (dates) {
        const parts = dates.split(' - ')
        sbUpdates.targetStartDate = parts[0] || null
        sbUpdates.targetEndDate = parts[1] || null
      } else {
        sbUpdates.targetStartDate = null
        sbUpdates.targetEndDate = null
      }
    }

    if (Object.keys(sbUpdates).length > 0) {
      await db.update(batchSyllabus).set(sbUpdates).where(eq(batchSyllabus.id, id))
    }

    // Update chapter fields
    const chapUpdates: any = {}
    if (notes !== undefined) chapUpdates.description = notes
    if (title !== undefined) chapUpdates.name = title
    if (estHours !== undefined) {
      chapUpdates.expectedHours = parseInt(estHours) || 10
    }

    if (Object.keys(chapUpdates).length > 0) {
      await db.update(chapters).set(chapUpdates).where(eq(chapters.id, sb.chapterId))
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const sessionSchoolId = getSchoolId(session)

    const data = await req.json()
    const targetSchoolId = data.schoolId || sessionSchoolId

    // Bulk creation support
    if (Array.isArray(data.items) || Array.isArray(data.chapters)) {
      const itemsToCreate = data.items || data.chapters
      const className = data.className || data.batch
      const subject = data.subject

      if (!className || !subject) {
        return NextResponse.json({ error: 'Class and Subject are required for bulk upload' }, { status: 400 })
      }
      // Batch & Subject (and School, in "Automatic" mode) are resolved --
      // and created if they don't exist -- per item below, since each Excel
      // row can name its own. className/subject above are only the fallback
      // for items that don't specify their own.

      const createdList: any[] = []
      // Rows skipped during "Automatic" school routing (Excel named a school
      // this session can't resolve/write to) -- surfaced to the frontend so
      // it can flag them instead of the row silently vanishing.
      const errors: { title: string; reason: string }[] = []

      for (const item of itemsToCreate) {
        if (!item.title || !item.title.trim()) continue
        const itemClassName = item.batch || className
        const itemSubjectName = item.subject || subject

        // Automatic school routing: an item can name its own school (from
        // the Excel row); otherwise it falls back to the upload's fixed
        // target school as before. An item-named school that doesn't
        // resolve to a school this session can write to is skipped rather
        // than silently filed under the wrong/fallback school.
        let itemSchoolId = targetSchoolId
        if (item.school && item.school.trim()) {
          const resolved = await resolveItemSchoolId(session, item.school)
          if (!resolved) {
            errors.push({ title: item.title, reason: `School "${item.school.trim()}" not found or not accessible` })
            continue
          }
          itemSchoolId = resolved
        }

        // Get or create Batch & Subject dynamically per item
        const bCond = itemSchoolId ? and(eq(batches.name, itemClassName), eq(batches.schoolId, itemSchoolId)) : eq(batches.name, itemClassName)
        const sCond = itemSchoolId ? and(eq(subjects.name, itemSubjectName), eq(subjects.schoolId, itemSchoolId)) : eq(subjects.name, itemSubjectName)
        let bRow = await db.select().from(batches).where(bCond).limit(1).then(r => r[0])
        let sRow = await db.select().from(subjects).where(sCond).limit(1).then(r => r[0])

        if (!bRow) {
          // A brand-new batch picks up its Program from the Excel row too
          // (get-or-create, same pattern as Batch/Subject). An existing
          // batch already has its own program link (batches.programId), so
          // it's left as-is rather than reassigned from a stray cell.
          let itemProgramId: string | undefined
          const itemProgramName = item.program && item.program.trim()
          if (itemProgramName) {
            const pCond = itemSchoolId ? and(ilike(programs.name, itemProgramName), eq(programs.schoolId, itemSchoolId)) : ilike(programs.name, itemProgramName)
            let pRow = await db.select().from(programs).where(pCond).limit(1).then(r => r[0])
            if (!pRow) {
              const [np] = await db.insert(programs).values({ name: itemProgramName, schoolId: itemSchoolId }).returning()
              pRow = np
            }
            itemProgramId = pRow.id
          }
          const [nb] = await db.insert(batches).values({ name: itemClassName, capacity: 60, classLevel: '11', schoolId: itemSchoolId, programId: itemProgramId }).returning()
          bRow = nb
        }
        if (!sRow) {
          const [ns] = await db.insert(subjects).values({ name: itemSubjectName, code: itemSubjectName.substring(0,3).toUpperCase(), schoolId: itemSchoolId }).returning()
          sRow = ns
        }

        const oCond = itemSchoolId ? and(eq(chapters.subjectId, sRow.id), eq(chapters.schoolId, itemSchoolId)) : eq(chapters.subjectId, sRow.id)
        const lastChapItem = await db.select({ orderIndex: chapters.orderIndex })
          .from(chapters)
          .where(oCond)
          .orderBy(desc(chapters.orderIndex))
          .limit(1)
          .then(r => r[0])
        const itemOrder = lastChapItem ? lastChapItem.orderIndex + 1 : 1

        const numHours = parseInt(item.estHours) || 10
        const [newChap] = await db.insert(chapters).values({
          subjectId: sRow.id,
          batchId: bRow.id,
          name: item.title,
          description: item.notes || '',
          expectedHours: numHours,
          orderIndex: itemOrder,
          schoolId: itemSchoolId,
        }).returning()

        const normalizedStatus = item.status === 'NOT STARTED' ? 'Not Started' :
                                 item.status === 'IN PROGRESS' ? 'In Progress' :
                                 item.status === 'COMPLETED' ? 'Completed' : 'Not Started'
        const parts = (item.dates || '').split(' - ')
        const targetStart = parts[0] || null
        const targetEnd = parts[1] || null

        const [newSyllabus] = await db.insert(batchSyllabus).values({
          batchId: bRow.id,
          chapterId: newChap.id,
          targetStartDate: targetStart,
          targetEndDate: targetEnd,
          status: normalizedStatus
        }).returning()

        createdList.push({
          _id: newSyllabus.id,
          title: newChap.name,
          estHours: `${newChap.expectedHours} hrs est.`,
          dates: [newSyllabus.targetStartDate, newSyllabus.targetEndDate].filter(Boolean).join(' - '),
          status: newSyllabus.status.toUpperCase(),
          notes: newChap.description,
          order: newChap.orderIndex,
          subject: itemSubjectName,
          batch: itemClassName
        })
      }

      return NextResponse.json({ success: true, count: createdList.length, chapters: createdList, errors })
    }

    // Single creation support
    const { className, subject, title, estHours, dates, status, notes } = data

    if (!className || !subject || !title) {
      return NextResponse.json({ error: 'Class, Subject, and Title are required' }, { status: 400 })
    }

    // Get or create Batch & Subject, scoped to this school.
    const batchCond = targetSchoolId ? and(eq(batches.name, className), eq(batches.schoolId, targetSchoolId)) : eq(batches.name, className)
    const subjectCond = targetSchoolId ? and(eq(subjects.name, subject), eq(subjects.schoolId, targetSchoolId)) : eq(subjects.name, subject)
    let batchRow = await db.select().from(batches).where(batchCond).limit(1).then(r => r[0])
    let subjectRow = await db.select().from(subjects).where(subjectCond).limit(1).then(r => r[0])

    if (!batchRow) {
      const [nb] = await db.insert(batches).values({ name: className, capacity: 60, classLevel: '11', schoolId: targetSchoolId }).returning()
      batchRow = nb
    }
    if (!subjectRow) {
      const [ns] = await db.insert(subjects).values({ name: subject, code: subject.substring(0,3).toUpperCase(), schoolId: targetSchoolId }).returning()
      subjectRow = ns
    }

    // Get order index, scoped to target school's chapters for this subject.
    const orderCond = targetSchoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, targetSchoolId)) : eq(chapters.subjectId, subjectRow.id)
    const lastChap = await db.select({ orderIndex: chapters.orderIndex })
      .from(chapters)
      .where(orderCond)
      .orderBy(desc(chapters.orderIndex))
      .limit(1)
      .then(r => r[0])
    const nextOrder = lastChap ? lastChap.orderIndex + 1 : 1

    const numHours = parseInt(estHours) || 10
    const [newChap] = await db.insert(chapters).values({
      subjectId: subjectRow.id,
      batchId: batchRow.id,
      name: title,
      description: notes || '',
      expectedHours: numHours,
      orderIndex: nextOrder,
      schoolId: targetSchoolId,
    }).returning()

    const normalizedStatus = status === 'NOT STARTED' ? 'Not Started' :
                             status === 'IN PROGRESS' ? 'In Progress' :
                             status === 'COMPLETED' ? 'Completed' : 'Not Started'
    const parts = (dates || '').split(' - ')
    const targetStart = parts[0] || null
    const targetEnd = parts[1] || null

    const [newSyllabus] = await db.insert(batchSyllabus).values({
      batchId: batchRow.id,
      chapterId: newChap.id,
      targetStartDate: targetStart,
      targetEndDate: targetEnd,
      status: normalizedStatus
    }).returning()

    return NextResponse.json({
      success: true,
      chapter: {
        _id: newSyllabus.id,
        title: newChap.name,
        estHours: `${newChap.expectedHours} hrs est.`,
        dates: [newSyllabus.targetStartDate, newSyllabus.targetEndDate].filter(Boolean).join(' - '),
        status: newSyllabus.status.toUpperCase(),
        notes: newChap.description,
        order: newChap.orderIndex
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing chapter ID' }, { status: 400 })

    const sb = await loadAuthorizedSyllabusRow(id, schoolId)
    if (!sb) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    await db.delete(chapters).where(eq(chapters.id, sb.chapterId))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
