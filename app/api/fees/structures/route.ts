import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getFeeStructureById
} from '@/lib/db/queries/fees'

export const dynamic = 'force-dynamic'

// GET — fetch fee structures from Neon database
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const schoolId = searchParams.get('schoolId') || (session.user as any)?.schoolId || null

    const structures = await listFeeStructures({
      search,
      schoolId: schoolId || undefined
    })

    // Map id to _id as well for transparent frontend compatibility
    const mapped = structures.map(s => ({
      ...s,
      _id: s.id
    }))

    return NextResponse.json(mapped)
  } catch (error: any) {
    console.error('GET /api/fees/structures error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// POST — create new fee structure in Neon database
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      feeType,
      description,
      amount,
      frequency,
      dueDay,
      isMandatory,
      programAssociation,
      batchAssociation,
      academicYear,
      schoolId
    } = body

    if (!name?.trim() || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields (name, amount).' }, { status: 400 })
    }

    const targetSchoolId = schoolId || (session.user as any)?.schoolId || null

    const created = await createFeeStructure({
      name: name.trim(),
      feeType: feeType || 'Monthly Tuition',
      description: description?.trim() || '',
      amount: Math.round(Number(amount)),
      frequency: frequency || 'Monthly',
      dueDay: Number(dueDay) || 5,
      isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
      programAssociation: programAssociation?.trim() || 'All Programs',
      batchAssociation: batchAssociation?.trim() || 'All Batches',
      academicYear: academicYear?.trim() || '2024-25',
      schoolId: targetSchoolId,
      isActive: true
    })

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/fees/structures error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// PUT — update fee structure in Neon database
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Fee Type ID is required' }, { status: 400 })

    const body = await req.json()
    const updatePayload: any = {}
    if (body.name !== undefined) updatePayload.name = body.name.trim()
    if (body.feeType !== undefined) updatePayload.feeType = body.feeType
    if (body.description !== undefined) updatePayload.description = body.description
    if (body.amount !== undefined) updatePayload.amount = Math.round(Number(body.amount))
    if (body.frequency !== undefined) updatePayload.frequency = body.frequency
    if (body.dueDay !== undefined) updatePayload.dueDay = Number(body.dueDay)
    if (body.isMandatory !== undefined) updatePayload.isMandatory = Boolean(body.isMandatory)
    if (body.programAssociation !== undefined) updatePayload.programAssociation = body.programAssociation
    if (body.batchAssociation !== undefined) updatePayload.batchAssociation = body.batchAssociation
    if (body.academicYear !== undefined) updatePayload.academicYear = body.academicYear
    if (body.isActive !== undefined) updatePayload.isActive = Boolean(body.isActive)

    const updated = await updateFeeStructure(id, updatePayload)
    if (!updated) return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 })

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error: any) {
    console.error('PUT /api/fees/structures error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// DELETE — delete fee structure from Neon database
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Fee Type ID is required' }, { status: 400 })

    const success = await deleteFeeStructure(id)
    if (!success) return NextResponse.json({ error: 'Fee structure not found or already deleted' }, { status: 404 })

    return NextResponse.json({ message: 'Fee structure deleted successfully' })
  } catch (error: any) {
    console.error('DELETE /api/fees/structures error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
