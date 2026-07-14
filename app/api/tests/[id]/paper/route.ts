import { NextRequest, NextResponse } from 'next/server'
import { put, get } from '@vercel/blob'
import { auth, getSchoolId } from '@/lib/auth'
import { db, tests } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// A test's paper is only ever reached through this route — never expose
// tests.paperUrl directly to the client — so every verb here re-checks the
// same ownership rule: management must match the test's school; a teacher
// must be the test's own creator.
async function loadAuthorizedTest(testId: string, session: any) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId))
  if (!test) return null

  const role = (session.user as any).role
  const userId = (session.user as any).id as string
  const schoolId = getSchoolId(session)

  if (role !== 'teacher' && role !== 'management') return null
  if (schoolId && test.schoolId !== schoolId) return null
  if (role === 'teacher' && test.createdByUserId !== userId) return null

  return test
}

// POST — attach a test-paper PDF (owning teacher or management only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 })
    }

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const blob = await put(`test-papers/${test.id}-${safeName}`, file, { access: 'private' })

    const [updated] = await db.update(tests)
      .set({ paperUrl: blob.url, paperFileName: file.name, updatedAt: new Date() })
      .where(eq(tests.id, test.id))
      .returning()

    return NextResponse.json({ paperUrl: updated.paperUrl, paperFileName: updated.paperFileName })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET — stream the attached test-paper PDF (owning teacher or management only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })
    if (!test.paperUrl) return NextResponse.json({ error: 'No paper attached to this test.' }, { status: 404 })

    const result = await get(test.paperUrl, { access: 'private' })
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'Failed to access the attached paper.' }, { status: 404 })
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.blob.contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="${test.paperFileName || 'test-paper.pdf'}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — clear the attached test-paper reference (owning teacher or management only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const test = await loadAuthorizedTest(id, session)
    if (!test) return NextResponse.json({ error: 'Test not found.' }, { status: 404 })

    await db.update(tests)
      .set({ paperUrl: null, paperFileName: null, updatedAt: new Date() })
      .where(eq(tests.id, test.id))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
