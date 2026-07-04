import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isAdminOfSchool, setActiveSchool } from '@/lib/db/queries/adminSchools'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { schoolId } = await req.json()
  if (!schoolId) return NextResponse.json({ error: 'schoolId is required' }, { status: 400 })

  const membership = await isAdminOfSchool(session.user.id!, schoolId)
  if (!membership) return NextResponse.json({ error: 'You do not have access to this school' }, { status: 403 })

  const [school] = await db.select({ id: schools.id, name: schools.name, isActive: schools.isActive }).from(schools).where(eq(schools.id, schoolId))
  if (!school || !school.isActive) return NextResponse.json({ error: 'School not found or inactive' }, { status: 404 })

  await setActiveSchool(session.user.id!, schoolId)
  return NextResponse.json({ schoolId, schoolName: school.name })
}
