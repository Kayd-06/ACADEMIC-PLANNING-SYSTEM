import { NextRequest, NextResponse } from 'next/server'
import { auth, getSchoolId } from '@/lib/auth'
import { createReport } from '@/lib/db/queries/student-reports'
import {
  StudentReportImportValidationError,
  validateStudentReportImport,
} from '@/lib/reports/student-report-import'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = session.user.role
    if (role !== 'teacher' && role !== 'management') {
      return NextResponse.json({ error: 'Only school staff can import student reports' }, { status: 403 })
    }
    const schoolId = getSchoolId(session)
    if (!schoolId) {
      return NextResponse.json({ error: 'Select or join a school before importing reports.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'The import request is not valid JSON.' }, { status: 400 })
    }

    const data = validateStudentReportImport(body)
    const report = await createReport({
      schoolId,
      teacherId: session.user.id,
      teacherName: session.user.name ?? (role === 'management' ? 'Management' : 'Faculty'),
      importedByRole: role,
      sourceFileName: data.sourceFileName,
      className: data.className,
      subject: data.subject,
      term: data.term,
      entries: data.entries,
    })

    return NextResponse.json({
      success: true,
      reportId: report.id,
      imported: report.entries.length,
      message: `${report.entries.length} student ${report.entries.length === 1 ? 'row' : 'rows'} imported successfully.`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof StudentReportImportValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 })
    }
    console.error('[student-reports/import POST]', error)
    return NextResponse.json({ error: 'Unable to save the imported report.' }, { status: 500 })
  }
}
