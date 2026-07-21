import { NextResponse } from 'next/server'
import { getSchoolById, updateSchool } from '@/lib/db/queries/school'
import { auth } from '@/lib/auth'
import { isValidGstPrefix, GST_FORMAT_ERROR } from '@/lib/validation/gst'
import { isValidPhone, PHONE_FORMAT_ERROR } from '@/lib/validation/phone'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No active school' }, { status: 404 })

    const school = await getSchoolById(schoolId)
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    return NextResponse.json(school, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch school details' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session || (session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schoolId = (session.user as any).schoolId as string | null
    if (!schoolId) return NextResponse.json({ error: 'No active school' }, { status: 404 })

    const data = await req.json()
    if (!isValidGstPrefix(data.gstNo)) {
      return NextResponse.json({ error: GST_FORMAT_ERROR }, { status: 400 })
    }
    if (!isValidPhone(data.phone)) {
      return NextResponse.json({ error: PHONE_FORMAT_ERROR }, { status: 400 })
    }
    const school = await updateSchool(schoolId, data)

    return NextResponse.json(school)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update school details' }, { status: 500 })
  }
}
