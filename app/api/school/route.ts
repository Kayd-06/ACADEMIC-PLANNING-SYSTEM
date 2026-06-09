import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import School from '@/models/School'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    let school = await School.findOne()
    if (!school) {
      school = await School.create({})
    }
    return NextResponse.json(school, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate'
      }
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
    await connectDB()
    
    let school = await School.findOne()
    if (!school) {
      school = await School.create(data)
    } else {
      school = await School.findByIdAndUpdate(school._id, { ...data, updatedAt: new Date() }, { new: true })
    }

    return NextResponse.json(school)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update school details' }, { status: 500 })
  }
}
