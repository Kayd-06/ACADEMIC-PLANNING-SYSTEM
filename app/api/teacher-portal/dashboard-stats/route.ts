import { NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { db } from '@/lib/db'
import { classSchedules, specialClasses, dailyReports, assignments, assignmentSubmissions, tests } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { getLocalToday, buildTodaysClasses } from '@/lib/scheduleUtils'

export const dynamic = 'force-dynamic'

// Real counts for the teacher dashboard's stat cards — previously hardcoded.
export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const email = (session.user.email ?? '').toLowerCase().trim()
    const userId = (session.user as any).id as string
    const schoolId = getSchoolId(session)
    const todayIso = getLocalToday()
    // Derived from the same IST calendar date todayIso represents, rather
    // than the runtime's own clock — new Date().getDay() would read the
    // server's local weekday, which disagrees with todayIso near the
    // UTC/IST day boundary on Vercel's UTC servers.
    const todayDow = new Date(`${todayIso}T00:00:00Z`).getUTCDay()

    // Pending Daily Reports: today's scheduled classes with no matching
    // submitted report yet (matched by batch + subject, same as the report
    // form itself is keyed).
    const schedCond = [eq(classSchedules.teacherEmail, email), eq(classSchedules.isActive, true)]
    if (schoolId) schedCond.push(eq(classSchedules.schoolId, schoolId))
    const specCond = [eq(specialClasses.teacherEmail, email), eq(specialClasses.date, todayIso)]
    if (schoolId) specCond.push(eq(specialClasses.schoolId, schoolId))
    const [regular, special] = await Promise.all([
      db.select().from(classSchedules).where(and(...schedCond)),
      db.select().from(specialClasses).where(and(...specCond)),
    ])
    const todaysClasses = buildTodaysClasses(regular, special, todayIso, todayDow)

    let pendingDailyReports = 0
    if (todaysClasses.length > 0) {
      const reportCond = [eq(dailyReports.teacherEmail, email), eq(dailyReports.date, todayIso)]
      if (schoolId) reportCond.push(eq(dailyReports.schoolId, schoolId))
      const todaysReports = await db.select().from(dailyReports).where(and(...reportCond))
      const reportedKeys = new Set(todaysReports.map(r => `${r.batch}|${r.subject}`))
      pendingDailyReports = todaysClasses.filter(c => !reportedKeys.has(`${c.batch}|${c.subject}`)).length
    }

    // Assignments to Grade: submissions awaiting a grade (Submitted or Late,
    // i.e. handed in but not yet Graded) for this teacher's own assignments.
    const assignCond = [eq(assignments.teacherEmail, email)]
    if (schoolId) assignCond.push(eq(assignments.schoolId, schoolId))
    const myAssignments = await db.select({ id: assignments.id }).from(assignments).where(and(...assignCond))
    const assignmentIds = myAssignments.map(a => a.id)
    let assignmentsToGrade = 0
    if (assignmentIds.length > 0) {
      const ungraded = await db.select({ id: assignmentSubmissions.id }).from(assignmentSubmissions)
        .where(and(
          inArray(assignmentSubmissions.assignmentId, assignmentIds),
          inArray(assignmentSubmissions.status, ['Submitted', 'Late'])
        ))
      assignmentsToGrade = ungraded.length
    }

    // Upcoming Tests: this teacher's own tests (per the ownership scoping in
    // app/api/tests/schedule/route.ts) still in "Upcoming" status.
    const testCond = [eq(tests.createdByUserId, userId), eq(tests.status, 'Upcoming')]
    if (schoolId) testCond.push(eq(tests.schoolId, schoolId))
    const upcoming = await db.select({ id: tests.id }).from(tests).where(and(...testCond))

    return NextResponse.json({
      pendingDailyReports,
      assignmentsToGrade,
      upcomingTests: upcoming.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
