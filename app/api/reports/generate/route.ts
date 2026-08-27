import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateStudentReport, generateBatchReports } from '@/lib/reports/generate-report'

export const dynamic = 'force-dynamic'

interface GenerateRequestBody {
  studentId?: string
  batchId?: string
  academicYear: string
  term: string
  fromDate: string
  toDate: string
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No school associated with this account' }, { status: 400 })

    const body = await req.json() as Partial<GenerateRequestBody>
    const { studentId, batchId, academicYear, term, fromDate, toDate } = body

    if (!academicYear || !term || !fromDate || !toDate) {
      return NextResponse.json({
        error: 'academicYear, term, fromDate, and toDate are required',
      }, { status: 400 })
    }

    if ((!studentId && !batchId) || (studentId && batchId)) {
      return NextResponse.json({
        error: 'Exactly one of studentId or batchId is required',
      }, { status: 400 })
    }

    const generatedBy = (session.user as any).id as string | undefined

    if (studentId) {
      const result = await generateStudentReport({
        studentId,
        schoolId,
        batchId: null,
        academicYear,
        term,
        fromDate,
        toDate,
        generatedBy: generatedBy ?? null,
      })
      return NextResponse.json(result)
    }

    const result = await generateBatchReports({
      batchId: batchId!,
      schoolId,
      academicYear,
      term,
      fromDate,
      toDate,
      generatedBy: generatedBy ?? null,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('reports/generate POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
