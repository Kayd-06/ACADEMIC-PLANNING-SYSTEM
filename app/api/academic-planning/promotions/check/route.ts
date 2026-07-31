import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runPromotionDetectionForSchool } from '@/lib/db/queries/classPromotion'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

  const [school] = await db.select({ academicYearStartMonth: schools.academicYearStartMonth }).from(schools).where(eq(schools.id, schoolId))
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

  const result = await runPromotionDetectionForSchool(schoolId, school.academicYearStartMonth)
  return NextResponse.json(result)
}
