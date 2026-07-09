import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  listFeePayments,
  createFeePayment,
  updateFeePayment,
  deleteFeePayment,
  getFeeStructureById,
  getFeePaymentById
} from '@/lib/db/queries/fees'
import { getStudentById } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

// GET — fetch payment records from Neon database
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const studentId = searchParams.get('studentId') || ''
    const feeStructureId = searchParams.get('feeStructureId') || searchParams.get('feeTypeId') || ''
    const schoolId = searchParams.get('schoolId') || (session.user as any)?.schoolId || null

    const records = await listFeePayments({
      search,
      status: status && status !== 'All' ? status : undefined,
      studentId: studentId || undefined,
      feeStructureId: feeStructureId || undefined,
      schoolId: schoolId || undefined
    })

    // Map id to _id for frontend compatibility
    const mapped = records.map(r => ({
      ...r,
      _id: r.id,
      feeTypeId: r.feeStructureId
    }))

    return NextResponse.json(mapped)
  } catch (error: any) {
    console.error('GET /api/fees/payments error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// POST — record a new fee payment in Neon database
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const {
      studentId,
      feeStructureId,
      feeTypeId,
      amountDue,
      amountPaid,
      amount,
      discount = 0,
      lateFee = 0,
      paymentMethod = 'UPI',
      transactionId = '',
      receiptNumber,
      dueDate,
      paidDate,
      status,
      notes = '',
      schoolId
    } = body

    const resolvedFeeStructureId = feeStructureId || feeTypeId
    if (!studentId || !resolvedFeeStructureId) {
      return NextResponse.json({ error: 'Student ID and Fee Structure ID are required.' }, { status: 400 })
    }

    const student = await getStudentById(studentId)
    if (!student) {
      return NextResponse.json({ error: 'Student record not found.' }, { status: 404 })
    }

    const feeStructure = await getFeeStructureById(resolvedFeeStructureId)
    if (!feeStructure) {
      return NextResponse.json({ error: 'Fee Structure record not found.' }, { status: 404 })
    }

    const resolvedAmountDue = amountDue !== undefined ? Number(amountDue) : feeStructure.amount
    const resolvedAmountPaid = amountPaid !== undefined ? Number(amountPaid) : (amount !== undefined ? Number(amount) : 0)
    const resolvedDiscount = Number(discount) || 0
    const resolvedLateFee = Number(lateFee) || 0

    const netPayable = Math.max(0, resolvedAmountDue + resolvedLateFee - resolvedDiscount)

    let resolvedStatus = status
    if (!resolvedStatus) {
      if (resolvedAmountPaid >= netPayable && netPayable > 0) {
        resolvedStatus = 'Paid'
      } else if (resolvedAmountPaid > 0) {
        resolvedStatus = 'Partial'
      } else {
        const now = new Date()
        const dueDt = dueDate ? new Date(dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        resolvedStatus = dueDt < now ? 'Overdue' : 'Pending'
      }
    }

    const resolvedReceiptNo = receiptNumber?.trim() || `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    const nowStr = new Date().toISOString().split('T')[0]
    const resolvedDueDate = dueDate || nowStr
    const resolvedPaidDate = paidDate !== undefined ? paidDate : (resolvedAmountPaid > 0 ? nowStr : '')

    const targetSchoolId = schoolId || student.schoolId || (session.user as any)?.schoolId || null

    const created = await createFeePayment({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo || '',
      class: student.class || '',
      section: student.section || '',
      feeStructureId: feeStructure.id,
      feeName: feeStructure.name,
      feeType: feeStructure.feeType || 'Monthly Tuition',
      schoolId: targetSchoolId,
      amountDue: Math.round(resolvedAmountDue),
      amountPaid: Math.round(resolvedAmountPaid),
      discount: Math.round(resolvedDiscount),
      lateFee: Math.round(resolvedLateFee),
      paymentMethod: paymentMethod || 'UPI',
      transactionId: transactionId || '',
      receiptNumber: resolvedReceiptNo,
      recordedBy: (session.user as any)?.id || null,
      recordedByName: (session.user as any)?.name || 'Management',
      dueDate: resolvedDueDate,
      paidDate: resolvedPaidDate,
      status: resolvedStatus,
      notes: notes || ''
    })

    return NextResponse.json({ ...created, _id: created.id, feeTypeId: created.feeStructureId }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/fees/payments error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// PUT — update an existing payment record in Neon database
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Payment Record ID is required' }, { status: 400 })

    const body = await req.json()
    const existing = await getFeePaymentById(id)
    if (!existing) return NextResponse.json({ error: 'Payment record not found' }, { status: 404 })

    const updatePayload: any = {}
    if (body.amountDue !== undefined) updatePayload.amountDue = Math.round(Number(body.amountDue))
    if (body.amountPaid !== undefined) updatePayload.amountPaid = Math.round(Number(body.amountPaid))
    if (body.amount !== undefined) updatePayload.amountPaid = Math.round(Number(body.amount))
    if (body.discount !== undefined) updatePayload.discount = Math.round(Number(body.discount))
    if (body.lateFee !== undefined) updatePayload.lateFee = Math.round(Number(body.lateFee))
    if (body.paymentMethod !== undefined) updatePayload.paymentMethod = body.paymentMethod
    if (body.transactionId !== undefined) updatePayload.transactionId = body.transactionId
    if (body.receiptNumber !== undefined) updatePayload.receiptNumber = body.receiptNumber
    if (body.dueDate !== undefined) updatePayload.dueDate = body.dueDate
    if (body.paidDate !== undefined) updatePayload.paidDate = body.paidDate
    if (body.status !== undefined) updatePayload.status = body.status
    if (body.notes !== undefined) updatePayload.notes = body.notes

    // Recompute status if amount changes and status wasn't explicitly set in body
    if (body.status === undefined && (body.amountPaid !== undefined || body.amount !== undefined)) {
      const due = updatePayload.amountDue !== undefined ? updatePayload.amountDue : existing.amountDue
      const late = updatePayload.lateFee !== undefined ? updatePayload.lateFee : existing.lateFee
      const disc = updatePayload.discount !== undefined ? updatePayload.discount : existing.discount
      const paid = updatePayload.amountPaid !== undefined ? updatePayload.amountPaid : existing.amountPaid
      const netPayable = Math.max(0, due + late - disc)
      if (paid >= netPayable && netPayable > 0) {
        updatePayload.status = 'Paid'
      } else if (paid > 0) {
        updatePayload.status = 'Partial'
      }
    }

    const updated = await updateFeePayment(id, updatePayload)
    if (!updated) return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })

    return NextResponse.json({ ...updated, _id: updated.id, feeTypeId: updated.feeStructureId })
  } catch (error: any) {
    console.error('PUT /api/fees/payments error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

// DELETE — delete payment record from Neon database
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Payment Record ID is required' }, { status: 400 })

    const success = await deleteFeePayment(id)
    if (!success) return NextResponse.json({ error: 'Payment record not found or already deleted' }, { status: 404 })

    return NextResponse.json({ message: 'Payment record deleted successfully' })
  } catch (error: any) {
    console.error('DELETE /api/fees/payments error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
