import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { batches, batchSyllabus, chapters, subjects } from '@/lib/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const className = searchParams.get('class') || 'Grade 11-A'
    const subjectName = searchParams.get('subject') || 'Physics'

    // 1. Get or create Batch
    let batchRow = await db.select().from(batches).where(eq(batches.name, className)).limit(1).then(r => r[0])
    if (!batchRow) {
      const [newBatch] = await db.insert(batches).values({
        name: className,
        capacity: 60,
        classLevel: '11'
      }).returning()
      batchRow = newBatch
    }

    // 2. Get or create Subject
    let subjectRow = await db.select().from(subjects).where(eq(subjects.name, subjectName)).limit(1).then(r => r[0])
    if (!subjectRow) {
      const [newSub] = await db.insert(subjects).values({
        name: subjectName,
        code: subjectName.substring(0, 3).toUpperCase(),
        description: `${subjectName} subject`
      }).returning()
      subjectRow = newSub
    }

    // 3. Get chapters
    let chapterRows = await db.select().from(chapters).where(eq(chapters.subjectId, subjectRow.id)).orderBy(asc(chapters.orderIndex))

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

    // 6. Query joined result
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
      .where(and(eq(batchSyllabus.batchId, batchRow.id), eq(chapters.subjectId, subjectRow.id)))
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

export async function PATCH(req: Request) {
  try {
    const { id, status, notes, title, estHours, dates } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing chapter/syllabus ID' }, { status: 400 })

    // Find the batchSyllabus entry
    const [sb] = await db.select().from(batchSyllabus).where(eq(batchSyllabus.id, id)).limit(1)
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
    const data = await req.json()
    const { className, subject, title, estHours, dates, status, notes } = data

    if (!className || !subject || !title) {
      return NextResponse.json({ error: 'Class, Subject, and Title are required' }, { status: 400 })
    }

    // Get or create Batch & Subject
    let batchRow = await db.select().from(batches).where(eq(batches.name, className)).limit(1).then(r => r[0])
    let subjectRow = await db.select().from(subjects).where(eq(subjects.name, subject)).limit(1).then(r => r[0])

    if (!batchRow) {
      const [nb] = await db.insert(batches).values({ name: className, capacity: 60, classLevel: '11' }).returning()
      batchRow = nb
    }
    if (!subjectRow) {
      const [ns] = await db.insert(subjects).values({ name: subject, code: subject.substring(0,3).toUpperCase() }).returning()
      subjectRow = ns
    }

    // Get order index
    const lastChap = await db.select({ orderIndex: chapters.orderIndex })
      .from(chapters)
      .where(eq(chapters.subjectId, subjectRow.id))
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
      orderIndex: nextOrder
    }).returning()

    const normalizedStatus = status === 'NOT STARTED' ? 'Not Started' :
                             status === 'IN PROGRESS' ? 'In Progress' :
                             status === 'COMPLETED' ? 'Completed' : 'Not Started'
    const parts = dates.split(' - ')
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
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing chapter ID' }, { status: 400 })

    const [sb] = await db.select().from(batchSyllabus).where(eq(batchSyllabus.id, id)).limit(1)
    if (!sb) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

    await db.delete(chapters).where(eq(chapters.id, sb.chapterId))
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
