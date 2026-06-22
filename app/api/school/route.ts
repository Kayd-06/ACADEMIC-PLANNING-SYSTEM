import { NextResponse } from 'next/server'
import { getOrCreateSchool, updateSchool } from '@/lib/db/queries/school'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const school = await getOrCreateSchool()
    return NextResponse.json(school, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch school details' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'management') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await req.json()
    const school = await updateSchool(data)

    return NextResponse.json(school)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update school details' }, { status: 500 })
  }
}
