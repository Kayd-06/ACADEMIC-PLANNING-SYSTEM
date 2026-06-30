import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { faculty } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await db.select().from(faculty).orderBy(faculty.name)
  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  }).returning()

  return NextResponse.json(created, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, name, subject, specialization, batches, experience, status, email, phone } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [updated] = await db.update(faculty).set({
    name, subject, specialization,
    batches: Number(batches) || 0,
    experience: experience || '',
    status,
    email: email || null,
    phone: phone || null,
  }).where(eq(faculty.id, id)).returning()

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.delete(faculty).where(eq(faculty.id, id))
  return NextResponse.json({ success: true })
}
