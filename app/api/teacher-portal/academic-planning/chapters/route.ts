import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { batches, batchSyllabus, chapters, subjects } from '@/lib/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { auth, getSchoolId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = getSchoolId(session)

    const { searchParams } = new URL(req.url)
    const className = searchParams.get('class') || 'Grade 11-A'
    const subjectName = searchParams.get('subject') || 'Physics'

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

    // 3. Get chapters, scoped to this school.
    const chapterCond = schoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, schoolId)) : eq(chapters.subjectId, subjectRow.id)
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
          targetStartDate: 'Aug 15',
          targetEndDate: 'Aug 28',
          status: 'Not Started'
        }))
        await db.insert(batchSyllabus).values(seedSyllabus)
      }
    }

    // 6. Query joined result, scoped to this school's chapters only.
    const joinChapterCond = schoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, schoolId)) : eq(chapters.subjectId, subjectRow.id)
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
    const formatted = dbResult.map(c => ({
      _id: c.syllabusId,
      title: c.title,
      estHours: c.estHours ? `${c.estHours} hrs est.` : '10 hrs est.',
      dates: `${c.targetStartDate || 'Aug 15'} - ${c.targetEndDate || 'Aug 28'}`,
      status: (c.status || 'Not Started').toUpperCase(),
      notes: c.notes || '',
      order: c.order || 0
    }))

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
    if (dates) {
      const parts = dates.split(' - ')
      sbUpdates.targetStartDate = parts[0] || 'Aug 15'
      sbUpdates.targetEndDate = parts[1] || 'Aug 28'
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

      // Get or create Batch & Subject, scoped to target school.
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

      // Get starting order index
      const orderCond = targetSchoolId ? and(eq(chapters.subjectId, subjectRow.id), eq(chapters.schoolId, targetSchoolId)) : eq(chapters.subjectId, subjectRow.id)
      const lastChap = await db.select({ orderIndex: chapters.orderIndex })
        .from(chapters)
        .where(orderCond)
        .orderBy(desc(chapters.orderIndex))
        .limit(1)
        .then(r => r[0])
      let currentOrder = lastChap ? lastChap.orderIndex + 1 : 1

      const createdList: any[] = []

      for (const item of itemsToCreate) {
        if (!item.title || !item.title.trim()) continue
        const itemClassName = item.batch || className
        const itemSubjectName = item.subject || subject

        // Get or create Batch & Subject dynamically per item
        const bCond = targetSchoolId ? and(eq(batches.name, itemClassName), eq(batches.schoolId, targetSchoolId)) : eq(batches.name, itemClassName)
        const sCond = targetSchoolId ? and(eq(subjects.name, itemSubjectName), eq(subjects.schoolId, targetSchoolId)) : eq(subjects.name, itemSubjectName)
        let bRow = await db.select().from(batches).where(bCond).limit(1).then(r => r[0])
        let sRow = await db.select().from(subjects).where(sCond).limit(1).then(r => r[0])

        if (!bRow) {
          const [nb] = await db.insert(batches).values({ name: itemClassName, capacity: 60, classLevel: '11', schoolId: targetSchoolId }).returning()
          bRow = nb
        }
        if (!sRow) {
          const [ns] = await db.insert(subjects).values({ name: itemSubjectName, code: itemSubjectName.substring(0,3).toUpperCase(), schoolId: targetSchoolId }).returning()
          sRow = ns
        }

        const oCond = targetSchoolId ? and(eq(chapters.subjectId, sRow.id), eq(chapters.schoolId, targetSchoolId)) : eq(chapters.subjectId, sRow.id)
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
          name: item.title,
          description: item.notes || '',
          expectedHours: numHours,
          orderIndex: itemOrder,
          schoolId: targetSchoolId,
        }).returning()

        const normalizedStatus = item.status === 'NOT STARTED' ? 'Not Started' :
                                 item.status === 'IN PROGRESS' ? 'In Progress' :
                                 item.status === 'COMPLETED' ? 'Completed' : 'Not Started'
        const parts = (item.dates || 'Aug 15 - Aug 28').split(' - ')
        const targetStart = parts[0] || 'Aug 15'
        const targetEnd = parts[1] || 'Aug 28'

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
          dates: `${newSyllabus.targetStartDate} - ${newSyllabus.targetEndDate}`,
          status: newSyllabus.status.toUpperCase(),
          notes: newChap.description,
          order: newChap.orderIndex,
          subject: itemSubjectName,
          batch: itemClassName
        })
      }

      return NextResponse.json({ success: true, count: createdList.length, chapters: createdList })
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
      name: title,
      description: notes || '',
      expectedHours: numHours,
      orderIndex: nextOrder,
      schoolId: targetSchoolId,
    }).returning()

    const normalizedStatus = status === 'NOT STARTED' ? 'Not Started' :
                             status === 'IN PROGRESS' ? 'In Progress' :
                             status === 'COMPLETED' ? 'Completed' : 'Not Started'
    const parts = (dates || 'Aug 15 - Aug 28').split(' - ')
    const targetStart = parts[0] || 'Aug 15'
    const targetEnd = parts[1] || 'Aug 28'

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
        dates: `${newSyllabus.targetStartDate} - ${newSyllabus.targetEndDate}`,
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
