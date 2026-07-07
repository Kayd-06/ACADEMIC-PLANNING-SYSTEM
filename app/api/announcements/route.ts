import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { announcements } from '@/lib/db/schema'
import { desc, eq, or, isNull, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { notifyRoleInSchool } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const TYPES = ['General', 'Academic', 'Exam', 'Holiday', 'Urgent', 'Fee']
const SCOPES = ['All', 'Program', 'Batch', 'Role']
const TARGET_ROLES = ['All', 'Teacher', 'Parent']

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  const d = new Date(expiryDate)
  if (isNaN(d.getTime())) return false
  d.setHours(23, 59, 59, 999)
  return d.getTime() < Date.now()
}

function toApiShape(r: any) {
  return {
    ...r,
    _id: r.id,
    label: r.title || r.label || '',
    sub: r.content || r.sub || '',
    urgent: r.type === 'Urgent' || r.urgent,
    expired: isExpired(r.expiryDate),
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = (session.user as any).role
    const schoolId = (session.user as any).schoolId as string | null

    const schoolCondition = schoolId
      ? or(eq(announcements.schoolId, schoolId), isNull(announcements.schoolId))
      : undefined

    const rows = schoolCondition
      ? await db.select().from(announcements).where(schoolCondition).orderBy(desc(announcements.pinned), desc(announcements.createdAt))
      : await db.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.createdAt))

    let visible = rows
    if (role === 'teacher') {
      // Teachers see announcements not restricted away from them, and not expired
      visible = rows.filter(r => {
        if (isExpired(r.expiryDate)) return false
        if (r.scope === 'Role' && r.targetRoles && r.targetRoles !== 'All' && r.targetRoles !== 'Teacher') return false
        return true
      })
    }

    return NextResponse.json(visible.map(toApiShape))
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch announcements' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    const data = await req.json()
    const { title, content, type, scope, scopeValue, targetRoles, pinned, authorName, authorRole, expiryDate, attachmentUrl, attachmentName } = data

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
    }
    if (type && !TYPES.includes(type)) {
      return NextResponse.json({ error: `Type must be one of: ${TYPES.join(', ')}` }, { status: 400 })
    }
    if (scope && !SCOPES.includes(scope)) {
      return NextResponse.json({ error: `Scope must be one of: ${SCOPES.join(', ')}` }, { status: 400 })
    }
    if (targetRoles && !TARGET_ROLES.includes(targetRoles)) {
      return NextResponse.json({ error: `Target role must be one of: ${TARGET_ROLES.join(', ')}` }, { status: 400 })
    }

    const [newRow] = await db.insert(announcements).values({
      title: title.trim(),
      content: content.trim(),
      label: title.trim(),
      sub: content.trim().slice(0, 100),
      type: type || 'General',
      scope: scope || 'All',
      scopeValue: scopeValue?.trim() || '',
      targetRoles: targetRoles || 'All',
      pinned: !!pinned,
      urgent: type === 'Urgent',
      attachmentUrl: attachmentUrl?.trim() || '',
      attachmentName: attachmentName?.trim() || '',
      authorName: authorName || session.user.name || 'Admin',
      authorRole: authorRole || 'Admin',
      expiryDate: expiryDate || null,
      schoolId,
    }).returning()

    // Per-user inbox fan-out: teachers get notified unless the announcement targets parents only
    const teachersTargeted = !(newRow.scope === 'Role' && newRow.targetRoles === 'Parent')
    if (teachersTargeted) {
      await notifyRoleInSchool(['teacher'], schoolId, {
        category: 'Announcement',
        title: newRow.type === 'Urgent' ? `🔴 Urgent: ${newRow.title}` : `New announcement: ${newRow.title}`,
        message: newRow.content.slice(0, 200),
        link: '/teacher',
      })
    }

    return NextResponse.json(toApiShape(newRow), { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create announcement' }, { status: 500 })
  }
}
