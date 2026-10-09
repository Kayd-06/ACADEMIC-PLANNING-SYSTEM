import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { attendanceSessions, attendanceEntries, classSchedules, specialClasses, students } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { notifyRoleInSchool } from '@/lib/notify'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'
import { unknownStudentIds, validateAttendanceRecords } from '@/lib/attendance/records'

export const dynamic = 'force-dynamic'

const DEFAULT_CLASS_TIME = '09:00 AM - 10:00 AM'

// A class's roster is every active student whose own `batch` field matches
// — batches and classes (grade levels) are independent fields, so matching
// on class here would silently return nobody for schools that name batches
// like "Batch 1" rather than a grade level.
async function findBatchRoster(batch: string, schoolId: string) {
  return db.select().from(students)
    .where(and(eq(students.batch, batch), eq(students.isActive, true), eq(students.schoolId, schoolId)))
    .orderBy(students.rollNo, students.name)
}

// One attendance sheet per (school, date, batch, subject, classTime). The
// unique index attendance_sessions_slot_unique (migration 0051) enforces it,
// so two teachers saving at the same moment can no longer create duplicates.
// classTime disambiguates multiple sessions of the same subject/batch on the
// same day (e.g. a regular period plus a same-subject revision session).
function sessionCondition(date: string, batch: string, subject: string, classTime: string, schoolId: string) {
  return and(
    eq(attendanceSessions.schoolId, schoolId),
    eq(attendanceSessions.date, date),
    eq(attendanceSessions.batch, batch),
    eq(attendanceSessions.subject, subject),
    eq(attendanceSessions.classTime, classTime),
  )
}

// Best-effort link to the recurring schedule slot or special class for this
// occurrence. When the client tells us the class time we prefer the slot that
// actually runs at that time instead of whichever row happens to come first.
async function findLinkedClass(date: string, batch: string, subject: string, schoolId: string, classTime = '') {
  const dayOfWeek = new Date(date).getDay()

  const schedules = await db.select().from(classSchedules).where(and(
    eq(classSchedules.batch, batch),
    eq(classSchedules.subject, subject),
    eq(classSchedules.dayOfWeek, dayOfWeek),
    eq(classSchedules.isActive, true),
    eq(classSchedules.schoolId, schoolId),
  )).limit(20)
  const schedule = (classTime && schedules.find(s => `${s.startTime} - ${s.endTime}` === classTime)) || schedules[0]
  if (schedule) return { scheduleId: schedule.id, specialClassId: null, classTime: `${schedule.startTime} - ${schedule.endTime}` }

  const specials = await db.select().from(specialClasses).where(and(
    eq(specialClasses.date, date),
    eq(specialClasses.batch, batch),
    eq(specialClasses.schoolId, schoolId),
  )).limit(20)
  const special =
    (classTime && specials.find(s => `${s.startTime} - ${s.endTime}` === classTime)) ||
    specials.find(s => s.subject === subject) ||
    specials[0]
  if (special) return { scheduleId: null, specialClassId: special.id, classTime: `${special.startTime} - ${special.endTime}` }

  return { scheduleId: null, specialClassId: null, classTime: '' }
}

// GET — load marked attendance sheet OR a fresh template for the batch roster.
// Read-only: never writes.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const batch = searchParams.get('batch')
    const subject = searchParams.get('subject')
    let classTime = searchParams.get('classTime') || ''

    if (!date || !batch || !subject) {
      return NextResponse.json({ error: 'Missing query parameters: date, batch, subject' }, { status: 400 })
    }
    const schoolId = requireSchool(session)

    if (!classTime) classTime = (await findLinkedClass(date, batch, subject, schoolId)).classTime

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
      classTime: classTime || DEFAULT_CLASS_TIME,
      records: defaultRecords,
      isNew: true,
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/attendance')
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

    const body = await req.json()
    const { date, batch, subject, classTime, records } = body

    if (!date || !batch || !subject || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required body parameters.' }, { status: 400 })
    }
    const validated = validateAttendanceRecords(records)
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })
    const schoolId = requireSchool(session)

    // Every student id on the sheet must be a student of the caller's school.
    if (validated.studentIds.length > 0) {
      const found = await db.select({ id: students.id }).from(students)
        .where(and(inArray(students.id, validated.studentIds), eq(students.schoolId, schoolId)))
      const unknown = unknownStudentIds(validated.studentIds, found.map((f) => f.id))
      if (unknown.length > 0) {
        return NextResponse.json({
          error: `${unknown.length} student(s) on this sheet are not students of your school. Refresh the roster and try again.`,
          unknownStudentIds: unknown,
        }, { status: 400 })
      }
    }

    const linked = await findLinkedClass(date, batch, subject, schoolId, classTime || '')
    const resolvedClassTime = classTime || linked.classTime || DEFAULT_CLASS_TIME
    const now = new Date()
    const markedByName = session.user.name ?? ''
    const markedByEmail = session.user.email ?? ''

    // 1) Upsert the session row on its unique key — race-free, no
    //    read-then-insert window that could create duplicate sheets.
    const [sheet] = await db.insert(attendanceSessions).values({
      date, batch, subject,
      classTime: resolvedClassTime,
      markedByName,
      markedByEmail,
      scheduleId: linked.scheduleId,
      specialClassId: linked.specialClassId,
      schoolId,
    }).onConflictDoUpdate({
      target: [
        attendanceSessions.schoolId,
        attendanceSessions.date,
        attendanceSessions.batch,
        attendanceSessions.subject,
        attendanceSessions.classTime,
      ],
      set: {
        markedByName,
        markedByEmail,
        scheduleId: linked.scheduleId,
        specialClassId: linked.specialClassId,
        updatedAt: now,
      },
    }).returning({ id: attendanceSessions.id })
    const sessionId = sheet.id

    // 2) Replace the entries atomically: db.batch runs inside one Postgres
    //    transaction. The first statement locks the sheet row, so two saves of
    //    the same sheet run one after the other — the second one's DELETE then
    //    sees (and removes) the first one's entries instead of both inserting
    //    a full set (duplicate students). attendance_entries_session_student_unique
    //    (migration 0051) is the backstop.
    const rows = validated.records.map(r => ({ sessionId, ...r }))
    const lockSheet = db.update(attendanceSessions).set({ updatedAt: now }).where(eq(attendanceSessions.id, sessionId))
    const deleteOld = db.delete(attendanceEntries).where(eq(attendanceEntries.sessionId, sessionId))
    let entries: Array<typeof attendanceEntries.$inferSelect> = []
    if (rows.length > 0) {
      const [, , inserted] = await db.batch([lockSheet, deleteOld, db.insert(attendanceEntries).values(rows).returning()])
      entries = inserted
    } else {
      await db.batch([lockSheet, deleteOld])
    }

    // 3) Notifications happen after the response — they can't slow down or
    //    fail the save.
    const markerName = session.user.name ?? 'Faculty'
    runAfterResponse('attendance-notify', () => notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Attendance',
        title: `Attendance Marked: ${subject} - ${batch}`,
        message: `Attendance for Subject: ${subject} (Batch: ${batch}) was marked by ${markerName} on ${date} for class time ${resolvedClassTime}.`,
      },
      (r) => r === 'teacher' ? '/teacher/attendance' : '/management/attendance'
    ))

    return NextResponse.json({
      _id: sessionId, date, batch, subject,
      classTime: resolvedClassTime,
      markedByName,
      records: entries.map(e => ({
        studentId: e.studentId, studentName: e.studentName, rollNo: e.rollNo, status: e.status, notes: e.notes,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'POST /api/attendance')
  }
}
