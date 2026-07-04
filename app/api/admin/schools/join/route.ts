import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { addSchoolToAdmin, isAdminOfSchool, setActiveSchool, getActiveSchoolId } from '@/lib/db/queries/adminSchools'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { joinCode } = await req.json()
  if (!joinCode?.trim()) return NextResponse.json({ error: 'Join code is required' }, { status: 400 })

  const [school] = await db.select().from(schools).where(eq(schools.joinCode, joinCode.trim().toUpperCase()))
  if (!school) return NextResponse.json({ error: 'Invalid invite code — no school found' }, { status: 404 })
  if (!school.isActive) return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })

  const existing = await isAdminOfSchool(session.user.id!, school.id)
  if (existing) return NextResponse.json({ error: 'You already have access to this school' }, { status: 409 })

  await addSchoolToAdmin(session.user.id!, school.id, 'member')

  const currentActive = await getActiveSchoolId(session.user.id!)
  if (!currentActive) {
    await setActiveSchool(session.user.id!, school.id)
  }

  return NextResponse.json({ ...school, role: 'member' })
}
