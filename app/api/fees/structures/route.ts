import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import FeeType from '@/models/FeeType'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch fee structures
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const query: Record<string, any> = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { programBatch: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    const feeTypes = await FeeType.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json(feeTypes)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — create new fee structure
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { name, description, programBatch, amount, frequency, academicYear } = body

    if (!name?.trim() || !programBatch?.trim() || typeof amount !== 'number' || !frequency || !academicYear?.trim()) {
      return NextResponse.json({ error: 'Missing or invalid required fields.' }, { status: 400 })
    }

    const feeType = await FeeType.create({
      name: name.trim(),
      description: description?.trim() || '',
      programBatch: programBatch.trim(),
      amount,
      frequency,
      academicYear: academicYear.trim(),
      isActive: true
    })

    return NextResponse.json(feeType, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT — update fee structure
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Fee Type ID is required' }, { status: 400 })

    const body = await req.json()
    const updatedFeeType = await FeeType.findByIdAndUpdate(id, body, { new: true })
    if (!updatedFeeType) return NextResponse.json({ error: 'Fee Type not found' }, { status: 404 })

    return NextResponse.json(updatedFeeType)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — delete fee structure
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Fee Type ID is required' }, { status: 400 })

    const deletedFeeType = await FeeType.findByIdAndDelete(id)
    if (!deletedFeeType) return NextResponse.json({ error: 'Fee Type not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
