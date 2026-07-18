import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'

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

// GET — resolve a join code to school info (public, used during registration preview)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('joinCode')
  if (!code) return NextResponse.json({ error: 'joinCode required' }, { status: 400 })

  const [school] = await db.select({ id: schools.id, name: schools.name, board: schools.board, isActive: schools.isActive })
    .from(schools).where(eq(schools.joinCode, code.trim().toUpperCase()))

  if (!school) return NextResponse.json({ error: 'Invalid join code' }, { status: 404 })
  if (!school.isActive) return NextResponse.json({ error: 'School is not active' }, { status: 403 })
  return NextResponse.json(school)
}

// POST — create a new school (management only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, board, classes, programs, mouStatus, adminEmail } = body
  if (!name) return NextResponse.json({ error: 'School name is required' }, { status: 400 })

  // Generate a unique join code
  let joinCode = generateJoinCode()
  let tries = 0
  while (tries < 5) {
    const existing = await db.select({ id: schools.id }).from(schools).where(eq(schools.joinCode, joinCode))
    if (existing.length === 0) break
    joinCode = generateJoinCode()
    tries++
  }

  const [school] = await db.insert(schools).values({
    name,
    board: board || 'CBSE Affiliated',
    classes: classes || '6, 7, 8, 9, 10, 11, 12',
    programs: programs || 'JEE, NEET, Foundational',
    mouStatus: mouStatus || 'Active (2025)',
    joinCode,
    adminEmail: adminEmail || session.user.email || '',
    isActive: true,
  }).returning()

  return NextResponse.json(school, { status: 201 })
}

// PATCH — update school settings (management, own school only)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'management') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolId = (session.user as any).schoolId as string | null
  if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

  const body = await req.json()
  const { name, board, classes, programs, mouStatus, isActive } = body

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (board !== undefined) updates.board = board
  if (classes !== undefined) updates.classes = classes
  if (programs !== undefined) updates.programs = programs
  if (mouStatus !== undefined) updates.mouStatus = mouStatus
  if (isActive !== undefined) updates.isActive = isActive

  const [updated] = await db.update(schools).set(updates).where(eq(schools.id, schoolId)).returning()
  return NextResponse.json(updated)
}
