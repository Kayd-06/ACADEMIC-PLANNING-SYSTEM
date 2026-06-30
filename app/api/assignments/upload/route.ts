import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assignments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing assignment ID' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'assignments')
  await mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  await writeFile(path.join(uploadDir, safeName), buffer)

  const fileUrl = `/uploads/assignments/${safeName}`

  const [updated] = await db.update(assignments).set({ fileUrl, updatedAt: new Date() }).where(eq(assignments.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json({ fileUrl, assignment: updated })
}
