import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { counselingSessions, type CounselingSession } from '@/lib/db/schema'
import { eq, and, or, ilike, desc, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type SessionType = 'Academic' | 'Career' | 'Personal' | 'Disciplinary' | 'Parent Meeting'
type SessionStatus = 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'

function toApiShape(session: CounselingSession | null) {
  if (!session) return null
  const { id, ...rest } = session
  return { _id: id, ...rest }
}

// GET - fetch all sessions with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const counselor = searchParams.get('counselor')
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
    if (counselor && counselor !== 'All') {
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
      stats: { sessionsThisWeek, upcomingSessions, noShowsThisMonth, studentsFlagged }
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
    const { studentName, counselor, type, date, time, notes, duration, durationMinutes, actionItems, nextSessionDate } = body

    if (!studentName?.trim() || !counselor?.trim() || !type || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const initials = studentName.trim().split(' ')
      .map((n: string) => n[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('')

    const minutes = Number(durationMinutes) || parseInt(String(duration || '').replace(/\D/g, ''), 10) || 30
    const [session] = await db.insert(counselingSessions).values({
      studentName: studentName.trim(),
      studentInitials: initials,
      counselor: counselor.trim(),
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

    return NextResponse.json(toApiShape(session), { status: 201 })
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
    const { id, status, flagged, notes, duration, type, durationMinutes, actionItems, nextSessionDate } = body

    if (!id) return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 })

    const updates: Partial<CounselingSession> = {}
    if (status !== undefined) updates.status = status as SessionStatus
    if (type !== undefined) updates.type = type as SessionType
    if (flagged !== undefined) updates.flagged = flagged
    if (notes !== undefined) updates.notes = notes
    if (actionItems !== undefined) updates.actionItems = actionItems
    if (nextSessionDate !== undefined) updates.nextSessionDate = nextSessionDate || null
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

    return NextResponse.json({ success: true })
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
