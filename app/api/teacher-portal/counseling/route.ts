import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { counselingSessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const list = schoolId
    ? await db.select().from(counselingSessions).where(eq(counselingSessions.schoolId, schoolId)).orderBy(counselingSessions.date)
    : await db.select().from(counselingSessions).orderBy(counselingSessions.date)

  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const { studentName, counselor, type, date, time, status, notes, duration } = body
  const initials = (studentName || '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const [created] = await db.insert(counselingSessions).values({
    studentName,
    studentInitials: initials,
    counselor,
    type: type || 'Academic',
    date,
    time: time || '10:00 AM',
    status: status || 'Scheduled',
    notes: notes || '',
    duration: duration || '30 mins',
    schoolId,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const { id, notes, status, date, time, duration } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(counselingSessions.id, id), eq(counselingSessions.schoolId, schoolId)) : eq(counselingSessions.id, id)
  const [updated] = await db.update(counselingSessions)
    .set({ notes, status, date, time, duration, updatedAt: new Date() })
    .where(condition)
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(counselingSessions.id, id), eq(counselingSessions.schoolId, schoolId)) : eq(counselingSessions.id, id)
  await db.delete(counselingSessions).where(condition)
  return NextResponse.json({ success: true })
}
