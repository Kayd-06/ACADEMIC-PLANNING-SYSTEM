import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { protocols } from '@/lib/db/schema'
import { eq, and, count, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const STATUSES = ['completed', 'pending', 'overdue']

const DEFAULT_PROTOCOLS = [
  { label: 'Child Safety Policy', sub: 'Reviewed: Oct 2023', status: 'completed', reviewedAt: 'Oct 2023' },
  { label: 'Emergency Response Drill', sub: 'Overdue by 5 days', status: 'overdue', overdueDays: 5 },
  { label: 'Data Privacy Agreement', sub: 'Signed & Active', status: 'completed', reviewedAt: 'Sep 2023' },
]

function toApiShape(p: typeof protocols.$inferSelect) {
  const { id, ...rest } = p
  return { _id: id, ...rest }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json([])

    // One-time seed for a brand-new school
    const [{ value: existingCount }] = await db.select({ value: count() }).from(protocols).where(eq(protocols.schoolId, schoolId))
    if (Number(existingCount) === 0) {
      await db.insert(protocols).values(DEFAULT_PROTOCOLS.map(p => ({ ...p, schoolId })))
    }

    const rows = await db.select().from(protocols).where(eq(protocols.schoolId, schoolId)).orderBy(asc(protocols.createdAt))
    return NextResponse.json(rows.map(toApiShape), {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can add protocols' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No active school selected' }, { status: 400 })

    const body = await req.json()
    const { label, sub, status, reviewedAt, overdueDays } = body
    if (!label?.trim()) return NextResponse.json({ error: 'Protocol name is required' }, { status: 400 })
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${STATUSES.join(', ')}` }, { status: 400 })
    }

    const [created] = await db.insert(protocols).values({
      label: label.trim(),
      sub: sub?.trim() || '',
      status: status || 'pending',
      reviewedAt: reviewedAt || null,
      overdueDays: overdueDays !== undefined && overdueDays !== '' ? Number(overdueDays) : null,
      schoolId,
    }).returning()

    return NextResponse.json(toApiShape(created), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can update protocols' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const body = await req.json()
    const { id, label, sub, status, reviewedAt, overdueDays } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${STATUSES.join(', ')}` }, { status: 400 })
    }

    const updates: Record<string, any> = { updatedAt: new Date() }
    if (label !== undefined) updates.label = label
    if (sub !== undefined) updates.sub = sub
    if (status !== undefined) updates.status = status
    if (reviewedAt !== undefined) updates.reviewedAt = reviewedAt
    if (overdueDays !== undefined) updates.overdueDays = overdueDays === '' ? null : Number(overdueDays)

    const condition = schoolId ? and(eq(protocols.id, id), eq(protocols.schoolId, schoolId)) : eq(protocols.id, id)
    const [updated] = await db.update(protocols).set(updates).where(condition).returning()
    if (!updated) return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })

    return NextResponse.json(toApiShape(updated))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Only management can remove protocols' }, { status: 403 })
    }
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const condition = schoolId ? and(eq(protocols.id, id), eq(protocols.schoolId, schoolId)) : eq(protocols.id, id)
    await db.delete(protocols).where(condition)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
