import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { attendanceSessions, attendanceEntries, classSchedules, specialClasses, students } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const STATUSES = ['Present', 'Absent', 'Late', 'Excused']

// A class's roster is every active student whose own `batch` field matches
// — batches and classes (grade levels) are independent fields, so matching
// on class here would silently return nobody for schools that name batches
// like "Batch 1" rather than a grade level.
async function findBatchRoster(batch: string, schoolId: string | null) {
  const conditions = [eq(students.batch, batch), eq(students.isActive, true)]
  if (schoolId) conditions.push(eq(students.schoolId, schoolId))
  return db.select().from(students).where(and(...conditions)).orderBy(students.rollNo, students.name)
}

// classTime disambiguates multiple sessions of the same subject/batch on the
// same day (e.g. a regular period plus a same-subject revision session) —
// without it, marking one silently overwrote the other's attendance sheet.
function sessionCondition(date: string, batch: string, subject: string, classTime: string, schoolId: string | null) {
  const conditions = [
    eq(attendanceSessions.date, date),
    eq(attendanceSessions.batch, batch),
    eq(attendanceSessions.subject, subject),
    eq(attendanceSessions.classTime, classTime),
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
    let classTime = searchParams.get('classTime') || ''

    if (!date || !batch || !subject) {
      return NextResponse.json({ error: 'Missing query parameters: date, batch, subject' }, { status: 400 })
    }

    const linked = await findLinkedClass(date, batch, subject, schoolId)
    if (!classTime) classTime = linked.classTime

    // Existing marked sheet?
    const [existing] = await db.select().from(attendanceSessions)
      .where(sessionCondition(date, batch, subject, classTime, schoolId))
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
    const roster = await findBatchRoster(batch, schoolId)
    const defaultRecords = roster.map(st => ({
      studentId: st.id,
      studentName: st.name,
      rollNo: st.rollNo || '',
      status: '', // unmarked
      notes: '',
    }))
    defaultRecords.sort((a, b) => a.studentName.localeCompare(b.studentName))

    return NextResponse.json({
      date,
      batch,
      subject,
      classTime: classTime || '09:00 AM - 10:00 AM',
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
    const resolvedClassTime = classTime || linked.classTime || '09:00 AM - 10:00 AM'

    // Upsert the session
    const [existing] = await db.select().from(attendanceSessions)
      .where(sessionCondition(date, batch, subject, resolvedClassTime, schoolId))

    let sessionId: string
    if (existing) {
      sessionId = existing.id
      await db.update(attendanceSessions).set({
        classTime: resolvedClassTime,
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
        classTime: resolvedClassTime,
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

    // Notify teachers and admins
    await notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Attendance',
        title: `Attendance Marked: ${subject} - ${batch}`,
        message: `Attendance for Subject: ${subject} (Batch: ${batch}) was marked by ${session.user.name ?? 'Faculty'} on ${date} for class time ${resolvedClassTime}.`,
      },
      (role) => role === 'teacher' ? '/teacher/attendance' : '/management/attendance'
    )

    return NextResponse.json({
      _id: sessionId, date, batch, subject,
      classTime: resolvedClassTime,
      markedByName: session.user.name ?? '',
      records: entries.map(e => ({
        studentId: e.studentId, studentName: e.studentName, rollNo: e.rollNo, status: e.status, notes: e.notes,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
