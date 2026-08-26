import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getGeneratedReportById,
  upsertReportSubjectAnalytics,
  type SubjectAnalyticsPayload,
} from '@/lib/db/queries/generated-reports'

export const dynamic = 'force-dynamic'

// GET /api/reports/generated/[id]
// Returns the full report with all subject analytics JOINed
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const report = await getGeneratedReportById(id, schoolId)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('generated-reports [id] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/reports/generated/[id]
// Upsert subject analytics for an existing report
// Body: { subjects: SubjectAnalyticsPayload[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    // Verify report ownership
    const report = await getGeneratedReportById(id, schoolId)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    const body = await req.json() as { subjects?: SubjectAnalyticsPayload[] }
    const subjects = body.subjects ?? []

    const rows = await upsertReportSubjectAnalytics(id, subjects)
    return NextResponse.json({ inserted: rows.length, subjects: rows })
  } catch (error: any) {
    console.error('generated-reports [id] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
