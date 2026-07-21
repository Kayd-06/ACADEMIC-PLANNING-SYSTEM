import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isAdminOfSchool, removeSchoolFromAdmin, setActiveSchool, getAdminSchools } from '@/lib/db/queries/adminSchools'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const membership = await isAdminOfSchool(session.user.id!, id)
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (membership.role !== 'owner') return NextResponse.json({ error: 'Only owners can edit school details' }, { status: 403 })

  const body = await req.json()
  const { name, board, classes, programs, mouStartDate, mouEndDate, isActive, contactPerson, email, address, gstNo } = body
  const updates: Record<string, any> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (board !== undefined) updates.board = board
  if (classes !== undefined) updates.classes = classes
  if (programs !== undefined) updates.programs = programs
  if (mouStartDate !== undefined) updates.mouStartDate = mouStartDate
  if (mouEndDate !== undefined) updates.mouEndDate = mouEndDate
  if (isActive !== undefined) updates.isActive = isActive
  if (contactPerson !== undefined) updates.contactPerson = contactPerson
  if (email !== undefined) updates.email = email
  if (address !== undefined) updates.address = address
  if (gstNo !== undefined) updates.gstNo = gstNo

  const [updated] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning()
  return NextResponse.json({ ...updated, role: membership.role })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const membership = await isAdminOfSchool(session.user.id!, id)
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (membership.role === 'owner') {
    await db.delete(schools).where(eq(schools.id, id))
  } else {
    await removeSchoolFromAdmin(session.user.id!, id)
  }

  const activeSchoolId = (session.user as any).schoolId as string | null
  if (activeSchoolId === id) {
    const remaining = await getAdminSchools(session.user.id!)
    const next = remaining.find(s => s.id !== id)
    await setActiveSchool(session.user.id!, next?.id ?? null)
    return NextResponse.json({ success: true, newSchoolId: next?.id ?? null })
  }

  return NextResponse.json({ success: true, newSchoolId: null })
}
