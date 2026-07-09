import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  createFeeStructure,
  createFeePayment,
  listFeeStructures
} from '@/lib/db/queries/fees'
import { listStudents } from '@/lib/db/queries/students'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { type, records, schoolId } = body

    if (!type || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Invalid payload. Must provide type ("structures" | "payments") and non-empty records array.' }, { status: 400 })
    }

    const targetSchoolId = schoolId || (session.user as any)?.schoolId || null
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    if (type === 'structures') {
      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        try {
          const name = (row['Fee Name'] || row['Fee Structure Name'] || row.name || '').toString().trim()
          const feeType = (row['Fee Category'] || row['Fee Type'] || row.feeType || 'Monthly Tuition').toString().trim()
          const amountStr = row['Amount (INR)'] ?? row['Amount'] ?? row.amount ?? 0
          const amount = Math.round(Number(amountStr))

          if (!name || isNaN(amount) || amount < 0) {
            errors.push(`Row ${i + 1}: Missing or invalid Fee Name (${name}) or Amount (${amountStr})`)
            failedCount++
            continue
          }

          const frequency = (row['Frequency'] || row.frequency || 'Monthly').toString().trim()
          const dueDayStr = row['Due Day'] ?? row.dueDay ?? 5
          const dueDay = Math.max(1, Math.min(31, Number(dueDayStr) || 5))

          const mandatoryRaw = (row['Mandatory'] ?? row.isMandatory ?? 'Yes').toString().trim().toLowerCase()
          const isMandatory = mandatoryRaw === 'yes' || mandatoryRaw === 'true' || mandatoryRaw === '1'

          const programAssociation = (row['Program'] || row.programAssociation || 'All Programs').toString().trim()
          const batchAssociation = (row['Batch'] || row.batchAssociation || 'All Batches').toString().trim()
          const academicYear = (row['Academic Year'] || row.academicYear || '2024-25').toString().trim()
          const description = (row['Description'] || row.description || '').toString().trim()

          await createFeeStructure({
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
            schoolId: targetSchoolId,
            isActive: true
          })
          successCount++
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message || 'Database error'}`)
          failedCount++
        }
      }
    } else if (type === 'payments') {
      // Pre-fetch students & fee structures for fast matching
      const allStudents = await listStudents({ schoolId: targetSchoolId })
      const allStructures = await listFeeStructures({ schoolId: targetSchoolId })

      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        try {
          const rollNo = (row['Student Roll No'] || row['Roll No'] || row.rollNo || '').toString().trim()
          const studentNameRaw = (row['Student Name'] || row.studentName || '').toString().trim()
          const feeStructureName = (row['Fee Structure Name'] || row['Fee Name'] || row.feeName || '').toString().trim()
          const amountDueStr = row['Amount Due'] ?? row.amountDue ?? 0
          const amountPaidStr = row['Amount Paid'] ?? row.amountPaid ?? 0
          const amountDue = Math.round(Number(amountDueStr))
          const amountPaid = Math.round(Number(amountPaidStr))

          if (!studentNameRaw && !rollNo) {
            errors.push(`Row ${i + 1}: Missing Student Roll No and Student Name`)
            failedCount++
            continue
          }
          if (!feeStructureName) {
            errors.push(`Row ${i + 1}: Missing Fee Structure Name`)
            failedCount++
            continue
          }

          // Match student by Roll No or Name
          let matchedStudent = allStudents.find(s => rollNo && s.rollNo?.toLowerCase() === rollNo.toLowerCase())
          if (!matchedStudent && studentNameRaw) {
            matchedStudent = allStudents.find(s => s.name?.toLowerCase().trim() === studentNameRaw.toLowerCase())
          }

          const resolvedStudentId = matchedStudent ? matchedStudent.id : null
          const resolvedStudentName = matchedStudent ? matchedStudent.name : (studentNameRaw || `Student (${rollNo})`)
          const resolvedRollNo = matchedStudent ? (matchedStudent.rollNo || rollNo) : rollNo

          // Match fee structure by Name
          const matchedStructure = allStructures.find(f => f.name.toLowerCase().trim() === feeStructureName.toLowerCase())
          const resolvedStructureId = matchedStructure ? matchedStructure.id : null
          const resolvedFeeType = matchedStructure ? (matchedStructure.feeType || 'Monthly Tuition') : (row['Fee Category'] || row.feeType || 'Monthly Tuition')

          const discount = Math.round(Number(row['Discount'] ?? row.discount ?? 0))
          const lateFee = Math.round(Number(row['Late Fee'] ?? row.lateFee ?? 0))
          const paymentMethod = (row['Payment Method'] || row.paymentMethod || 'UPI').toString().trim()
          const transactionId = (row['Transaction ID'] || row.transactionId || '').toString().trim()
          
          let receiptNumber = (row['Receipt Number'] || row.receiptNumber || '').toString().trim()
          if (!receiptNumber) {
            receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
          }

          const nowStr = new Date().toISOString().split('T')[0]
          const dueDate = (row['Due Date'] || row.dueDate || nowStr).toString().trim()
          const paidDate = (row['Paid Date'] || row.paidDate || (amountPaid > 0 ? nowStr : '')).toString().trim()

          let status = (row['Status'] || row.status || '').toString().trim()
          if (!status) {
            const netPayable = Math.max(0, amountDue + lateFee - discount)
            if (amountPaid >= netPayable && netPayable > 0) status = 'Paid'
            else if (amountPaid > 0) status = 'Partial'
            else status = 'Pending'
          }

          const notes = (row['Notes'] || row.notes || '').toString().trim()

          await createFeePayment({
            studentId: resolvedStudentId,
            studentName: resolvedStudentName,
            rollNo: resolvedRollNo,
            class: matchedStudent ? (matchedStudent.class || '') : '',
            section: matchedStudent ? (matchedStudent.section || '') : '',
            feeStructureId: resolvedStructureId,
            feeName: feeStructureName,
            feeType: resolvedFeeType,
            schoolId: targetSchoolId,
            amountDue: isNaN(amountDue) ? (matchedStructure?.amount || 0) : amountDue,
            amountPaid: isNaN(amountPaid) ? 0 : amountPaid,
            discount: isNaN(discount) ? 0 : discount,
            lateFee: isNaN(lateFee) ? 0 : lateFee,
            paymentMethod,
            transactionId,
            receiptNumber,
            recordedBy: (session.user as any)?.id || null,
            recordedByName: (session.user as any)?.name || 'Excel Bulk Import',
            dueDate,
            paidDate,
            status,
            notes
          })
          successCount++
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message || 'Database error'}`)
          failedCount++
        }
      }
    }

    return NextResponse.json({
      successCount,
      failedCount,
      errors: errors.slice(0, 10), // Return top 10 errors for feedback
      message: `Successfully imported ${successCount} ${type === 'structures' ? 'fee structures' : 'payment records'} into Neon Postgres.`
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/fees/bulk-import error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
