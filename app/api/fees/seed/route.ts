import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listFeeStructures, createFeeStructure, listFeePayments, createFeePayment } from '@/lib/db/queries/fees'
import { listStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const schoolId = (session.user as any)?.schoolId || null

    const existingStructures = await listFeeStructures({ schoolId })
    if (existingStructures.length > 0) {
      return NextResponse.json({ message: 'Fee structures already exist in database. Skipping seed.' }, { status: 200 })
    }

    // 1. Create sample fee structures matching all parts of the user mind map
    const structuresData = [
      {
        feeType: 'Registration Fee',
        name: 'New Student Admission & Registration Fee',
        description: 'One-time registration and onboarding fee',
        amount: 5000,
        frequency: 'One-time',
        dueDay: 1,
        isMandatory: true,
        programAssociation: 'All Programs',
        batchAssociation: 'All Batches',
        academicYear: '2024-25',
        schoolId,
        isActive: true
      },
      {
        feeType: 'Monthly Tuition',
        name: 'Tuition Fee - Advanced Science / JEE Core',
        description: 'Standard monthly tuition for JEE Core 2026',
        amount: 12500,
        frequency: 'Monthly',
        dueDay: 5,
        isMandatory: true,
        programAssociation: 'STEM',
        batchAssociation: 'JEE 2026-A',
        academicYear: '2024-25',
        schoolId,
        isActive: true
      },
      {
        feeType: 'Monthly Tuition',
        name: 'Tuition Fee - Foundation 10',
        description: 'Standard monthly tuition for Class 10 Foundation',
        amount: 8000,
        frequency: 'Monthly',
        dueDay: 5,
        isMandatory: true,
        programAssociation: 'Foundation',
        batchAssociation: 'Foundation 10',
        academicYear: '2024-25',
        schoolId,
        isActive: true
      },
      {
        feeType: 'Exam Fee',
        name: 'Term 1 Mid-Year Examination Fee',
        description: 'Evaluation, invigilation, and grading fee',
        amount: 2500,
        frequency: 'Quarterly',
        dueDay: 15,
        isMandatory: true,
        programAssociation: 'All Programs',
        batchAssociation: 'All Batches',
        academicYear: '2024-25',
        schoolId,
        isActive: true
      },
      {
        feeType: 'Material Fee',
        name: 'Annual Study Material & Digital Portal Fee',
        description: 'Printed comprehensive modules & LMS portal access',
        amount: 15000,
        frequency: 'Yearly',
        dueDay: 10,
        isMandatory: false,
        programAssociation: 'STEM',
        batchAssociation: 'JEE 2026-A',
        academicYear: '2024-25',
        schoolId,
        isActive: true
      }
    ]

    const createdStructures = []
    for (const st of structuresData) {
      createdStructures.push(await createFeeStructure(st))
    }

    // 2. Fetch active students to create sample payment transactions
    const students = await listStudents({ activeOnly: true, schoolId })
    if (students.length > 0 && createdStructures.length >= 4) {
      const coreTuition = createdStructures[1]
      const examFee = createdStructures[3]
      const nowStr = new Date().toISOString().split('T')[0]

      // Create a few sample payments
      const sampleStudents = students.slice(0, Math.min(10, students.length))
      for (let i = 0; i < sampleStudents.length; i++) {
        const s = sampleStudents[i]
        const isPaid = i % 3 !== 2
        const amountDue = i % 2 === 0 ? coreTuition.amount : examFee.amount
        const discount = i === 1 ? 1000 : 0
        const lateFee = !isPaid && i % 2 === 1 ? 500 : 0
        const amountPaid = isPaid ? Math.max(0, amountDue + lateFee - discount) : (i === 2 ? 3000 : 0)

        let status = 'Pending'
        if (isPaid) status = 'Paid'
        else if (amountPaid > 0) status = 'Partial'
        else if (i % 4 === 3) status = 'Overdue'

        await createFeePayment({
          studentId: s.id,
          studentName: s.name,
          rollNo: s.rollNo || `RN-${100 + i}`,
          class: s.class || 'Class 11',
          section: s.section || 'A',
          feeStructureId: i % 2 === 0 ? coreTuition.id : examFee.id,
          feeName: i % 2 === 0 ? coreTuition.name : examFee.name,
          feeType: i % 2 === 0 ? coreTuition.feeType : examFee.feeType,
          schoolId,
          amountDue,
          amountPaid,
          discount,
          lateFee,
          paymentMethod: ['UPI', 'Card', 'Net Banking', 'Cash'][i % 4],
          transactionId: isPaid ? `TXN-2026-${849200 + i}` : '',
          receiptNumber: `REC-2026-${1000 + i}`,
          recordedBy: (session.user as any)?.id || null,
          recordedByName: 'Management Admin',
          dueDate: nowStr,
          paidDate: isPaid ? nowStr : '',
          status,
          notes: discount > 0 ? 'Concession applied based on merit scholarship' : ''
        })
      }
    }

    return NextResponse.json({ message: 'Sample fee data seeded successfully into Postgres database!' }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/fees/seed error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
