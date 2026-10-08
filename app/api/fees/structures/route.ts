import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
} from '@/lib/db/queries/fees'
import { notifyRoleInSchool } from '@/lib/notify'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { runAfterResponse } from '@/lib/sideEffects'

export const dynamic = 'force-dynamic'

// GET — fetch fee structures from Neon database
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    // School comes from the session only (no ?schoolId= override).
    const schoolId = requireSchool(session)

    const structures = await listFeeStructures({ search, schoolId })

    // Map id to _id as well for transparent frontend compatibility
    const mapped = structures.map(s => ({
      ...s,
      _id: s.id
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    return errorResponse(error, 'GET /api/fees/structures')
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
    } = body

    if (!name?.trim() || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid required fields (name, amount).' }, { status: 400 })
    }

    // Body schoolId is ignored — structures are created in the active school.
    const targetSchoolId = requireSchool(session)

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

    // Notify teachers and admins after the response is sent
    runAfterResponse('fee-structure-created', () => notifyRoleInSchool(
      ['teacher', 'management'],
      targetSchoolId,
      {
        category: 'Fee',
        title: `New Fee Structure: ${created.name}`,
        message: `A new fee structure of amount $${created.amount} (${created.frequency}) is set up for ${created.programAssociation} - ${created.batchAssociation}.`,
        link: '/management/fee-management',
      }
    ))

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/fees/structures')
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

    const schoolId = requireSchool(session)
    const updated = await updateFeeStructure(id, updatePayload, schoolId)
    if (!updated) return NextResponse.json({ error: 'Fee structure not found' }, { status: 404 })

    runAfterResponse('fee-structure-updated', () => notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Fee',
        title: `Fee Structure Updated: ${updated.name}`,
        message: `The fee structure "${updated.name}" is updated. Amount is now $${updated.amount} (${updated.frequency}).`,
        link: '/management/fee-management',
      }
    ))

    return NextResponse.json({ ...updated, _id: updated.id })
  } catch (error) {
    return errorResponse(error, 'PUT /api/fees/structures')
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

    const schoolId = requireSchool(session)
    const struct = await deleteFeeStructure(id, schoolId)
    if (!struct) return NextResponse.json({ error: 'Fee structure not found or already deleted' }, { status: 404 })

    runAfterResponse('fee-structure-deleted', () => notifyRoleInSchool(
      ['teacher', 'management'],
      schoolId,
      {
        category: 'Fee',
        title: `Fee Structure Deleted: ${struct.name}`,
        message: `The fee structure of amount $${struct.amount} (${struct.frequency}) has been deleted.`,
        link: '/management/fee-management',
      }
    ))

    return NextResponse.json({ message: 'Fee structure deleted successfully' })
  } catch (error) {
    return errorResponse(error, 'DELETE /api/fees/structures')
  }
}
