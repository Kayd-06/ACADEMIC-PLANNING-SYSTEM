import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { attendanceSessions, attendanceEntries, classSchedules, specialClasses } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { findStudentsByClasses } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

const STATUSES = ['Present', 'Absent', 'Late', 'Excused']

// Helper to map UI Batch dropdown values to DB Student Class formats
function resolveClassFromBatch(batch: string): string {
  let cls = batch.trim()
  if (cls.toLowerCase().startsWith('grade ')) {
    cls = cls.substring(6)
  }
  if (/^\d+-[A-Z]$/.test(cls)) {
    const parts = cls.split('-')
    cls = `${parts[0]} - ${parts[1]}`
  }
  return cls
}

function sessionCondition(date: string, batch: string, subject: string, schoolId: string | null) {
  const conditions = [
    eq(attendanceSessions.date, date),
    eq(attendanceSessions.batch, batch),
    eq(attendanceSessions.subject, subject),
  ]
  if (schoolId) conditions.push(eq(attendanceSessions.schoolId, schoolId))
  return and(...conditions)
}

// Best-effort link to the recurring schedule slot or special class for this occurrence
async function findLinkedClass(date: string, batch: string, subject: string, schoolId: string | null) {
  const dayOfWeek = new Date(date).getDay()

  const scheduleConditions = [
    eq(classSchedules.batch, batch),
    eq(classSchedules.subject, subject),
    eq(classSchedules.dayOfWeek, dayOfWeek),
    eq(classSchedules.isActive, true),
  ]
  if (schoolId) scheduleConditions.push(eq(classSchedules.schoolId, schoolId))
  const [schedule] = await db.select().from(classSchedules).where(and(...scheduleConditions)).limit(1)
  if (schedule) return { scheduleId: schedule.id, specialClassId: null, classTime: `${schedule.startTime} - ${schedule.endTime}` }

  const specialConditions = [eq(specialClasses.date, date), eq(specialClasses.batch, batch)]
  if (schoolId) specialConditions.push(eq(specialClasses.schoolId, schoolId))
  const [special] = await db.select().from(specialClasses).where(and(...specialConditions)).limit(1)
  if (special) return { scheduleId: null, specialClassId: special.id, classTime: `${special.startTime} - ${special.endTime}` }

  return { scheduleId: null, specialClassId: null, classTime: '' }
}

// GET — load marked attendance sheet OR a fresh template for the batch roster
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const batch = searchParams.get('batch')
    const subject = searchParams.get('subject')

    if (!date || !batch || !subject) {
      return NextResponse.json({ error: 'Missing query parameters: date, batch, subject' }, { status: 400 })
    }

    // Existing marked sheet?
    const [existing] = await db.select().from(attendanceSessions)
      .where(sessionCondition(date, batch, subject, schoolId))
    if (existing) {
      const entries = await db.select().from(attendanceEntries)
        .where(eq(attendanceEntries.sessionId, existing.id))
      entries.sort((a, b) => a.studentName.localeCompare(b.studentName))
      return NextResponse.json({
        _id: existing.id,
        date: existing.date,
        batch: existing.batch,
        subject: existing.subject,
        classTime: existing.classTime,
        markedByName: existing.markedByName,
        markedByEmail: existing.markedByEmail,
        scheduleId: existing.scheduleId,
        specialClassId: existing.specialClassId,
        records: entries.map(e => ({
          studentId: e.studentId,
          studentName: e.studentName,
          rollNo: e.rollNo,
          status: e.status,
          notes: e.notes,
        })),
      })
    }

    // Fresh template from the batch roster
    const resolvedClass = resolveClassFromBatch(batch)
    const students = await findStudentsByClasses([resolvedClass, batch], true, schoolId)
    const defaultRecords = students.map(st => ({
      studentId: st.id,
      studentName: st.name,
      rollNo: st.rollNo || '',
      status: '', // unmarked
      notes: '',
    }))
    defaultRecords.sort((a, b) => a.studentName.localeCompare(b.studentName))

    const linked = await findLinkedClass(date, batch, subject, schoolId)

    return NextResponse.json({
      date,
      batch,
      subject,
      classTime: linked.classTime || '09:00 AM - 10:00 AM',
      records: defaultRecords,
      isNew: true,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — save or update attendance sheet
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any).role
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { date, batch, subject, classTime, records } = body

    if (!date || !batch || !subject || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required body parameters.' }, { status: 400 })
    }
    for (const r of records) {
      if (r.status && !STATUSES.includes(r.status)) {
        return NextResponse.json({ error: `Invalid status "${r.status}" — must be one of: ${STATUSES.join(', ')}` }, { status: 400 })
      }
    }

    const linked = await findLinkedClass(date, batch, subject, schoolId)

    // Upsert the session
    const [existing] = await db.select().from(attendanceSessions)
      .where(sessionCondition(date, batch, subject, schoolId))

    let sessionId: string
    if (existing) {
      sessionId = existing.id
      await db.update(attendanceSessions).set({
        classTime: classTime || existing.classTime,
        markedByName: session.user.name ?? '',
        markedByEmail: session.user.email ?? '',
        scheduleId: linked.scheduleId,
        specialClassId: linked.specialClassId,
        updatedAt: new Date(),
      }).where(eq(attendanceSessions.id, sessionId))
      // Replace entries wholesale — simplest correct upsert
      await db.delete(attendanceEntries).where(eq(attendanceEntries.sessionId, sessionId))
    } else {
      const [created] = await db.insert(attendanceSessions).values({
        date, batch, subject,
        classTime: classTime || linked.classTime || '09:00 AM - 10:00 AM',
        markedByName: session.user.name ?? '',
        markedByEmail: session.user.email ?? '',
        scheduleId: linked.scheduleId,
        specialClassId: linked.specialClassId,
        schoolId,
      }).returning()
      sessionId = created.id
    }

    if (records.length > 0) {
      await db.insert(attendanceEntries).values(records.map((r: any) => ({
        sessionId,
        studentId: r.studentId || null,
        studentName: r.studentName,
        rollNo: r.rollNo || '',
        status: r.status || 'Absent',
        notes: r.notes || '',
      })))
    }

    const entries = await db.select().from(attendanceEntries).where(eq(attendanceEntries.sessionId, sessionId))
    return NextResponse.json({
      _id: sessionId, date, batch, subject,
      classTime: classTime || linked.classTime,
      markedByName: session.user.name ?? '',
      records: entries.map(e => ({
        studentId: e.studentId, studentName: e.studentName, rollNo: e.rollNo, status: e.status, notes: e.notes,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
