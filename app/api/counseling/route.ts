import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { counselingSessions, users, notifications, type CounselingSession } from '@/lib/db/schema'
import { eq, and, or, ilike, desc, asc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

function getScheduleNotificationTime(dateStr: string, timeStr?: string | null): Date {
  const time = timeStr ? timeStr.trim() : '00:00'
  let hours = 0
  let minutes = 0

  const match = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (match) {
    hours = Number(match[1])
    minutes = Number(match[2])
    const ampm = match[3].toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
  } else {
    const parts = time.split(':').map(Number)
    hours = parts[0] || 0
    minutes = parts[1] || 0
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  const eventDate = new Date(year, month - 1, day, hours, minutes)
  return new Date(eventDate.getTime() - 24 * 60 * 60 * 1000)
}

async function notifyCounselor(
  counselorId: string | null | undefined,
  counselorRole: string | null | undefined,
  title: string,
  message: string,
  schoolId: string | null,
  createdAt?: Date
) {
  if (!counselorId) return
  const link = counselorRole === 'teacher' ? '/teacher/counseling-log' : '/management/counseling'
  await db.insert(notifications).values({
    userId: counselorId,
    category: 'General',
    title,
    message,
    link,
    isRead: false,
    schoolId,
    ...(createdAt ? { createdAt } : {}),
  })
}

export const dynamic = 'force-dynamic'

type SessionType = 'Academic' | 'Career' | 'Personal' | 'Disciplinary' | 'Parent Meeting'
type SessionStatus = 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'

function toApiShape(session: CounselingSession | null) {
  if (!session) return null
  const { id, ...rest } = session
  return { _id: id, ...rest }
}

// GET - fetch all sessions with optional filters and active real counselors list
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const counselor = searchParams.get('counselor')
    const counselorId = searchParams.get('counselorId')
    const flagged = searchParams.get('flagged')
    const search = searchParams.get('search')

    const conditions = []
    if (schoolId) conditions.push(eq(counselingSessions.schoolId, schoolId))
    if (status && status !== 'All') {
      conditions.push(eq(counselingSessions.status, status as SessionStatus))
    }
    if (type && type !== 'All') {
      conditions.push(eq(counselingSessions.type, type as SessionType))
    }
    if (counselorId && counselorId !== 'All') {
      if (counselor && counselor !== 'All') {
        conditions.push(or(eq(counselingSessions.counselorId, counselorId), eq(counselingSessions.counselor, counselor)))
      } else {
        conditions.push(eq(counselingSessions.counselorId, counselorId))
      }
    } else if (counselor && counselor !== 'All') {
      conditions.push(eq(counselingSessions.counselor, counselor))
    }
    if (flagged === 'true') {
      conditions.push(eq(counselingSessions.flagged, true))
    }

    if (search) {
      conditions.push(
        or(
          ilike(counselingSessions.studentName, `%${search}%`),
          ilike(counselingSessions.counselor, `%${search}%`)
        )
      )
    }

    let sessionsQuery
    if (conditions.length > 0) {
      sessionsQuery = db.select().from(counselingSessions).where(and(...conditions))
    } else {
      sessionsQuery = db.select().from(counselingSessions)
    }
    const sessionsList = await sessionsQuery.orderBy(desc(counselingSessions.date), asc(counselingSessions.time))

    const mappedSessions = sessionsList.map(s => toApiShape(s))

    // Fetch real counselors (both admins & faculty belonging to this school)
    const schoolUsersQuery = schoolId
      ? db.select({
          id: users.id,
          name: users.name,
          role: users.role,
          email: users.email
        }).from(users).where(
          and(
            inArray(users.role, ['teacher', 'management']),
            or(eq(users.schoolId, schoolId), eq(users.activeSchoolId, schoolId))
          )
        )
      : db.select({
          id: users.id,
          name: users.name,
          role: users.role,
          email: users.email
        }).from(users).where(inArray(users.role, ['teacher', 'management']))

    const schoolUsers = await schoolUsersQuery.orderBy(asc(users.name))

    // Compute stats (school-scoped)
    const all = schoolId
      ? await db.select().from(counselingSessions).where(eq(counselingSessions.schoolId, schoolId))
      : await db.select().from(counselingSessions)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const sessionsThisWeek = all.filter(s => {
      const d = new Date(s.date)
      return d >= startOfWeek && d <= endOfWeek
    }).length

    const upcomingSessions = all.filter(s => {
      const d = new Date(s.date)
      return d >= now && s.status === 'Scheduled'
    }).length

    const noShowsThisMonth = all.filter(s => {
      const d = new Date(s.date)
      return d >= startOfMonth && d <= endOfMonth && s.status === 'No-Show'
    }).length

    const studentsFlagged = all.filter(s => s.flagged).length

    return NextResponse.json({
      sessions: mappedSessions,
      stats: { sessionsThisWeek, upcomingSessions, noShowsThisMonth, studentsFlagged },
      counselors: schoolUsers
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
    })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - schedule a new session
export async function POST(req: NextRequest) {
  try {
    const authSession = await auth()
    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (authSession.user as any).schoolId as string | null

    const body = await req.json()
    const { studentName, counselor, counselorId, counselorRole, type, date, time, notes, duration, durationMinutes, actionItems, nextSessionDate } = body

    if (!studentName?.trim() || (!counselor?.trim() && !counselorId) || !type || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    let finalCounselorId = counselorId || null
    let finalCounselorRole = counselorRole || null
    let finalCounselorName = counselor?.trim() || ''

    if (finalCounselorId && (!finalCounselorRole || !finalCounselorName)) {
      const [userRecord] = await db.select().from(users).where(eq(users.id, finalCounselorId)).limit(1)
      if (userRecord) {
        finalCounselorName = finalCounselorName || userRecord.name
        finalCounselorRole = finalCounselorRole || userRecord.role
      }
    } else if (!finalCounselorId && finalCounselorName) {
      const conditionsUser: any[] = [eq(users.name, finalCounselorName)]
      if (schoolId) conditionsUser.push(or(eq(users.schoolId, schoolId), eq(users.activeSchoolId, schoolId)))
      const [userRecord] = await db.select().from(users).where(and(...conditionsUser)).limit(1)
      if (userRecord) {
        finalCounselorId = userRecord.id
        finalCounselorRole = userRecord.role
      }
    }

    const initials = studentName.trim().split(' ')
      .map((n: string) => n[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('')

    const minutes = Number(durationMinutes) || parseInt(String(duration || '').replace(/\D/g, ''), 10) || 30
    const [sessionRecord] = await db.insert(counselingSessions).values({
      studentName: studentName.trim(),
      studentInitials: initials,
      counselor: finalCounselorName || 'Counselor',
      counselorId: finalCounselorId,
      counselorRole: finalCounselorRole,
      type: type as SessionType,
      date,
      time,
      status: 'Scheduled',
      notes: notes?.trim() || '',
      actionItems: actionItems?.trim() || '',
      duration: duration || `${minutes} mins`,
      durationMinutes: minutes,
      nextSessionDate: nextSessionDate || null,
      flagged: false,
      schoolId,
    }).returning()

    const notifyTime = getScheduleNotificationTime(sessionRecord.date, sessionRecord.time)

    // Notify specifically the assigned counselor
    if (finalCounselorId && finalCounselorId !== authSession.user.id) {
      await notifyCounselor(
        finalCounselorId,
        finalCounselorRole,
        `Counseling Scheduled: ${sessionRecord.studentName}`,
        `You have been scheduled as the counselor for ${sessionRecord.studentName} on ${sessionRecord.date} at ${sessionRecord.time}.`,
        schoolId,
        notifyTime
      )
    }

    // Also notify management so admins stay informed
    await notifyRoleInSchool(
      ['management'],
      schoolId,
      {
        category: 'General',
        title: `Counseling Scheduled: ${sessionRecord.studentName}`,
        message: `Session for ${sessionRecord.studentName} with Counselor: ${sessionRecord.counselor} is scheduled on ${sessionRecord.date} at ${sessionRecord.time}.`,
        createdAt: notifyTime,
      },
      () => '/management/counseling'
    )

    return NextResponse.json(toApiShape(sessionRecord), { status: 201 })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH - update session status, flag, or session records
export async function PATCH(req: NextRequest) {
  try {
    const authSession = await auth()
    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (authSession.user as any).schoolId as string | null

    const body = await req.json()
    const { id, status, flagged, notes, duration, type, durationMinutes, actionItems, nextSessionDate, counselorId, counselorRole, counselor } = body

    if (!id) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 })

    const updates: Partial<CounselingSession> = {}
    if (status !== undefined) updates.status = status as SessionStatus
    if (type !== undefined) updates.type = type as SessionType
    if (flagged !== undefined) updates.flagged = flagged
    if (notes !== undefined) updates.notes = notes
    if (actionItems !== undefined) updates.actionItems = actionItems
    if (nextSessionDate !== undefined) updates.nextSessionDate = nextSessionDate || null
    if (counselor !== undefined) updates.counselor = counselor
    if (counselorId !== undefined) updates.counselorId = counselorId || null
    if (counselorRole !== undefined) updates.counselorRole = counselorRole || null

    if (durationMinutes !== undefined) {
      const minutes = Number(durationMinutes) || 30
      updates.durationMinutes = minutes
      updates.duration = `${minutes} mins`
    } else if (duration !== undefined) {
      updates.duration = duration
      const minutes = parseInt(String(duration).replace(/\D/g, ''), 10)
      if (minutes) updates.durationMinutes = minutes
    }
    updates.updatedAt = new Date()

    const condition = schoolId
      ? and(eq(counselingSessions.id, id), eq(counselingSessions.schoolId, schoolId))
      : eq(counselingSessions.id, id)
    const [updated] = await db.update(counselingSessions)
      .set(updates)
      .where(condition)
      .returning()

    if (!updated) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

    const notifyTime = getScheduleNotificationTime(updated.date, updated.time)

    // Notify specifically the assigned counselor if updated by another person
    if (updated.counselorId && updated.counselorId !== authSession.user.id) {
      await notifyCounselor(
        updated.counselorId,
        updated.counselorRole,
        `Counseling Updated: ${updated.studentName}`,
        `Counseling session status updated to ${updated.status}. Scheduled on ${updated.date} at ${updated.time}.`,
        schoolId,
        notifyTime
      )
    }

    await notifyRoleInSchool(
      ['management'],
      schoolId,
      {
        category: 'General',
        title: `Counseling Updated: ${updated.studentName}`,
        message: `Counseling session status updated to ${updated.status}. Scheduled on ${updated.date} at ${updated.time}.`,
        createdAt: notifyTime,
      },
      () => '/management/counseling'
    )

    return NextResponse.json(toApiShape(updated))
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE - remove a session
export async function DELETE(req: NextRequest) {
  try {
    const authSession = await auth()
    if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (authSession.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 })

    const condition = schoolId
      ? and(eq(counselingSessions.id, id), eq(counselingSessions.schoolId, schoolId))
      : eq(counselingSessions.id, id)
    const [deleted] = await db.delete(counselingSessions)
      .where(condition)
      .returning()

    if (!deleted) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })

    if (deleted.counselorId && deleted.counselorId !== authSession.user.id) {
      await notifyCounselor(
        deleted.counselorId,
        deleted.counselorRole,
        `Counseling Cancelled: ${deleted.studentName}`,
        `The counseling session scheduled for ${deleted.studentName} on ${deleted.date} at ${deleted.time} has been cancelled.`,
        schoolId
      )
    }

    await notifyRoleInSchool(
      ['management'],
      schoolId,
      {
        category: 'General',
        title: `Counseling Cancelled: ${deleted.studentName}`,
        message: `The counseling session scheduled for ${deleted.studentName} on ${deleted.date} at ${deleted.time} has been cancelled.`,
      },
      () => '/management/counseling'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

