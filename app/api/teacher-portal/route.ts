import { NextResponse } from 'next/server'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { classSchedules, counselingSessions, feedback, specialClasses, studyMaterials, teacherScheduleItems } from '@/lib/db/schema'
import { requireSchool } from '@/lib/tenant'
import { errorResponse, HttpError } from '@/lib/api/http'
import { todayIST, toScheduleItem, toTeacherSchedule } from '@/lib/legacyPortal'
import { splitTeacherFeedback } from '@/lib/feedback/scope'

export const dynamic = 'force-dynamic'

// Teacher portal overview — moved from four MongoDB collections to the
// Postgres tables the rest of the app already uses. Same response shape as
// before: { schedule, counseling, materials, feedback } with `_id` on items.
//   schedule   today's recurring classes (class_schedules) + one-off classes (special_classes)
//              + the teacher's own schedule items (teacher_schedule_items)
//   counseling recent counseling_sessions
//   materials  study_materials grouped by provider
//   feedback   recent management -> teacher feedback (for a teacher: only
//              what is addressed to them, same rule as /api/feedback)
// Read-only (the old GET inserted demo rows whenever a collection was empty)
// and scoped to the session's school; a teacher sees their own classes and
// counseling sessions.


export async function GET() {
  try {
    const session = await auth()
    if (!session) throw new HttpError(401, 'Unauthorized')
    const role = (session.user as any).role
    if (role !== 'management' && role !== 'teacher') throw new HttpError(403, 'Forbidden')
    const schoolId = requireSchool(session)
    const email = ((session.user as any).email || '') as string
    const userId = (session.user as any).id as string | undefined
    const isTeacher = role === 'teacher'

    const today = todayIST()
    const dayOfWeek = new Date(`${today}T00:00:00Z`).getUTCDay()

    const recurringWhere = [eq(classSchedules.schoolId, schoolId), eq(classSchedules.dayOfWeek, dayOfWeek), eq(classSchedules.isActive, true)]
    const specialWhere = [eq(specialClasses.schoolId, schoolId), eq(specialClasses.date, today)]
    const counselingWhere = [eq(counselingSessions.schoolId, schoolId)]
    const itemWhere = [eq(teacherScheduleItems.schoolId, schoolId), eq(teacherScheduleItems.date, today)]
    if (isTeacher) {
      itemWhere.push(eq(teacherScheduleItems.ownerEmail, email.trim().toLowerCase()))
      recurringWhere.push(eq(classSchedules.teacherEmail, email))
      specialWhere.push(eq(specialClasses.teacherEmail, email))
      if (userId) counselingWhere.push(eq(counselingSessions.counselorId, userId))
    }

    const [recurring, specials, counseling, materials, feedbackRows, items] = await Promise.all([
      db.select().from(classSchedules).where(and(...recurringWhere)).orderBy(asc(classSchedules.startTime)),
      db.select().from(specialClasses).where(and(...specialWhere)).orderBy(asc(specialClasses.startTime)),
      db.select().from(counselingSessions).where(and(...counselingWhere)).orderBy(desc(counselingSessions.createdAt)).limit(20),
      db.select({
        provider: studyMaterials.provider,
        count: sql<number>`count(*)::int`,
        type: sql<string>`max(${studyMaterials.type})`,
        subject: sql<string>`max(${studyMaterials.subject})`,
      }).from(studyMaterials).where(eq(studyMaterials.schoolId, schoolId))
        .groupBy(studyMaterials.provider).orderBy(asc(studyMaterials.provider)),
      db.select().from(feedback)
        .where(and(eq(feedback.schoolId, schoolId), eq(feedback.type, 'Management -> Teacher')))
        .orderBy(desc(feedback.createdAt)).limit(200),
      db.select().from(teacherScheduleItems).where(and(...itemWhere)).orderBy(asc(teacherScheduleItems.time)),
    ])

    const visibleFeedback = (isTeacher
      ? splitTeacherFeedback(feedbackRows, { name: session.user?.name || '', email }).received
      : feedbackRows
    ).slice(0, 20)

    const schedule = [
      ...recurring.map(r => ({
        _id: r.id,
        id: r.id,
        date: today,
        time: r.startTime,
        activity: r.subject,
        batch: r.batch,
        location: r.room,
        status: 'Upcoming' as const,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      ...specials.map(r => toTeacherSchedule(r, today)),
      ...items.map(r => toScheduleItem(r, today)),
    ]

    return NextResponse.json({
      schedule,
      counseling: counseling.map(c => ({
        _id: c.id,
        id: c.id,
        studentName: c.studentName,
        category: c.type,
        description: c.notes || c.actionItems || '',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      materials: materials.map(m => ({
        _id: m.provider,
        provider: m.provider,
        count: m.count,
        type: m.type,
        subject: m.subject,
        initials: m.provider.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
      })),
      feedback: visibleFeedback.map(f => ({
        _id: f.id,
        id: f.id,
        from: f.isAnonymous ? 'Anonymous' : (f.senderName || 'Management'),
        context: f.date,
        content: f.content,
        type: 'coordinator' as const,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error) {
    return errorResponse(error, 'GET /api/teacher-portal')
  }
}
