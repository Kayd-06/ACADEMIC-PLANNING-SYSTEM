import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { schools, announcements } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getAdminSchools, addSchoolToAdmin, setActiveSchool } from '@/lib/db/queries/adminSchools'

export const dynamic = 'force-dynamic'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const list = await getAdminSchools(session.user.id!)
    return NextResponse.json(list || [])
  } catch (error: any) {
    console.error('[GET /api/admin/schools] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, board, classes, programs, mouStatus, contactPerson, email, address, gstNo } = body
  if (!name?.trim()) return NextResponse.json({ error: 'School name is required' }, { status: 400 })

  let joinCode = generateJoinCode()
  let tries = 0
  while (tries < 5) {
    const existing = await db.select({ id: schools.id }).from(schools).where(eq(schools.joinCode, joinCode))
    if (existing.length === 0) break
    joinCode = generateJoinCode()
    tries++
  }

  const [school] = await db.insert(schools).values({
    name: name.trim(),
    board: board || 'CBSE Affiliated',
    classes: classes || '6, 7, 8, 9, 10, 11, 12',
    programs: programs || 'JEE, NEET, Foundational',
    mouStatus: mouStatus || 'Active (2025)',
    joinCode,
    adminEmail: session.user.email || '',
    contactPerson: contactPerson || '',
    email: email || '',
    address: address || '',
    gstNo: gstNo || '',
    isActive: true,
  }).returning()

  // Insert default welcome announcement for the new school
  await db.insert(announcements).values({
    title: `Welcome to ${school.name}!`,
    content: `We are thrilled to welcome all our dedicated Admin and Faculty members to a new academic year. Your hard work and commitment make ${school.name} a place of excellence. Let's make this year our best one yet!`,
    label: `Welcome to ${school.name}!`,
    sub: `We are thrilled to welcome all our dedicated Admin and Faculty members to a new academic year. Your hard work and commitment make ${school.name} a place of excellence.`,
    type: 'General',
    scope: 'All',
    scopeValue: '',
    targetRoles: 'All',
    pinned: true,
    urgent: false,
    authorName: 'Admin',
    authorRole: 'Staff',
    done: false,
    schoolId: school.id,
  })

  await addSchoolToAdmin(session.user.id!, school.id, 'owner')

  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) {
    await setActiveSchool(session.user.id!, school.id)
  }

  return NextResponse.json({ ...school, role: 'owner' }, { status: 201 })
}
