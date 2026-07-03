import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function schoolFilter(schoolId: string | null) {
  return schoolId ? eq(faculty.schoolId, schoolId) : undefined
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const list = schoolId
    ? await db.select().from(faculty).where(eq(faculty.schoolId, schoolId)).orderBy(faculty.name)
    : await db.select().from(faculty).orderBy(faculty.name)

  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const { name, subject, specialization, batches, experience, status, email, phone } = body

  if (!name || !subject || !specialization) {
    return NextResponse.json({ error: 'name, subject, and specialization are required' }, { status: 400 })
  }

  const [created] = await db.insert(faculty).values({
    name, subject, specialization,
    batches: Number(batches) || 0,
    experience: experience || '',
    status: status || 'ACTIVE',
    email: email || null,
    phone: phone || null,
    schoolId,
  }).returning()

  return NextResponse.json(created, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const body = await req.json()
  const { id, name, subject, specialization, batches, experience, status, email, phone } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(faculty.id, id), eq(faculty.schoolId, schoolId)) : eq(faculty.id, id)
  const [updated] = await db.update(faculty).set({
    name, subject, specialization,
    batches: Number(batches) || 0,
    experience: experience || '',
    status,
    email: email || null,
    phone: phone || null,
  }).where(condition).returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const schoolId = (session.user as any).schoolId as string | null

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const condition = schoolId ? and(eq(faculty.id, id), eq(faculty.schoolId, schoolId)) : eq(faculty.id, id)
  await db.delete(faculty).where(condition)
  return NextResponse.json({ success: true })
}
