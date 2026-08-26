import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listGeneratedReports,
  createGeneratedReport,
  updateGeneratedReport,
  deleteGeneratedReport,
  type CreateReportPayload,
} from '@/lib/db/queries/generated-reports'

export const dynamic = 'force-dynamic'

// GET — list generated student reports
// ?studentId= &batchId= &academicYear= &term= &status=
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const { searchParams } = new URL(req.url)
    const filters = {
      studentId:    searchParams.get('studentId')   || null,
      batchId:      searchParams.get('batchId')     || null,
      academicYear: searchParams.get('academicYear')|| null,
      term:         searchParams.get('term')        || null,
      status:       searchParams.get('status')      || null,
    }

    const rows = await listGeneratedReports(filters, schoolId)
    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('generated-reports GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create a new generated student report (with optional subject analytics)
// Body: CreateReportPayload (see generated-reports.ts)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

    const body = await req.json() as Partial<CreateReportPayload>
    const { studentId, reportTitle, academicYear, term } = body

    if (!studentId || !reportTitle || !academicYear || !term) {
      return NextResponse.json({
        error: 'studentId, reportTitle, academicYear, and term are required',
      }, { status: 400 })
    }

    const userId = (session.user as any).id as string | undefined

    const report = await createGeneratedReport({
      ...body,
      schoolId,
      studentId,
      reportTitle,
      academicYear,
      term,
      generatedBy: userId ?? null,
    } as CreateReportPayload)

    return NextResponse.json(report, { status: 201 })
  } catch (error: any) {
    console.error('generated-reports POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — update report by ?id= (status changes, remarks, aggregate metrics)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await req.json()
    const report = await updateGeneratedReport(id, body, schoolId)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

    return NextResponse.json(report)
  } catch (error: any) {
    console.error('generated-reports PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — delete a report by ?id= (cascades to subject analytics)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    await deleteGeneratedReport(id, schoolId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('generated-reports DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
