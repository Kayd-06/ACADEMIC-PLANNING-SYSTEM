import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { computeStudentAnalytics } from '@/lib/reports/student-analytics'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: studentId } = await params
    const schoolId = (session.user as any).schoolId as string | null

    const result = await computeStudentAnalytics(studentId, schoolId)
    if (!result) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[Student Full Reports GET error]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
