import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import PaymentRecord from '@/models/PaymentRecord'
import Student from '@/models/Student'
import FeeType from '@/models/FeeType'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — fetch payment records
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const query: Record<string, any> = {}
    if (status && status !== 'All') {
      query.status = status
    }

    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { feeName: { $regex: search, $options: 'i' } }
      ]
    }

    const records = await PaymentRecord.find(query).sort({ createdAt: -1 }).lean()
    return NextResponse.json(records)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — record a payment
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await req.json()
    const { studentId, feeTypeId, amount, paymentMethod, transactionId, dueDate } = body

    if (!studentId || !feeTypeId || typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: 'Missing or invalid parameters.' }, { status: 400 })
    }

    // Fetch student & fee type details
    const student = await Student.findById(studentId)
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

    const feeType = await FeeType.findById(feeTypeId)
    if (!feeType) return NextResponse.json({ error: 'Fee Type not found.' }, { status: 404 })

    // Check if a payment record already exists for this student and fee type
    let record = await PaymentRecord.findOne({ studentId, feeTypeId })

    if (record) {
      record.amountPaid += amount
      if (record.amountPaid >= record.totalAmount) {
        record.status = 'Paid'
      } else {
        // If it's overdue or pending
        const now = new Date()
        record.status = new Date(record.dueDate) < now ? 'Overdue' : 'Pending'
      }
      record.paidDate = new Date()
      if (paymentMethod) record.paymentMethod = paymentMethod
      if (transactionId) record.transactionId = transactionId
      await record.save()
    } else {
      const now = new Date()
      const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      let initialStatus: 'Paid' | 'Pending' | 'Overdue' = 'Pending'
      if (amount >= feeType.amount) {
        initialStatus = 'Paid'
      } else if (resolvedDueDate < now) {
        initialStatus = 'Overdue'
      }

      record = await PaymentRecord.create({
        studentId,
        studentName: student.name,
        rollNo: student.rollNo || '',
        class: student.class || '',
        section: student.section || '',
        feeTypeId,
        feeName: feeType.name,
        amountPaid: amount,
        totalAmount: feeType.amount,
        status: initialStatus,
        dueDate: resolvedDueDate,
        paidDate: amount > 0 ? new Date() : undefined,
        transactionId: transactionId || '',
        paymentMethod: paymentMethod || undefined
      })
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
