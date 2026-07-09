import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { schools, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ensureFacultyRecord } from '@/lib/db/queries/faculty'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') {
    return NextResponse.json({ error: 'Only teachers can use this endpoint' }, { status: 403 })
  }

  const { joinCode } = await req.json()
  if (!joinCode?.trim()) return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })

  const [school] = await db.select().from(schools).where(eq(schools.joinCode, joinCode.trim().toUpperCase()))
  if (!school) return NextResponse.json({ error: 'Invalid invite code — no school found' }, { status: 404 })
  if (!school.isActive) return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })

  await db.update(users)
    .set({ schoolId: school.id, updatedAt: new Date() })
    .where(eq(users.id, session.user.id!))

  await ensureFacultyRecord({
    userId: session.user.id!,
    schoolId: school.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    department: (session.user as any).department ?? null,
  })

  return NextResponse.json({ schoolId: school.id, schoolName: school.name ?? 'School' })
}
