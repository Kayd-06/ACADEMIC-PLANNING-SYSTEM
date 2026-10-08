import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { feePayments, feeStructures, type NewFeePayment, type NewFeeStructure } from '@/lib/db/schema'
import { listFeeStructures } from '@/lib/db/queries/fees'
import { listStudents } from '@/lib/db/queries/students'
import { requireSchool } from '@/lib/tenant'
import { errorResponse } from '@/lib/api/http'
import { chunk, mapWithConcurrency } from '@/lib/concurrency'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_SIZE = 100
const CONCURRENCY = 3

/** Insert parsed rows in chunks of 100 (3 at a time), one statement per chunk. */
async function insertChunks<T extends { row: number }>(
  items: T[],
  write: (part: T[]) => Promise<number>,
  errors: string[],
): Promise<number> {
  const parts = chunk(items, CHUNK_SIZE)
  const results = await mapWithConcurrency(parts, CONCURRENCY, write)
  let saved = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      saved += r.value
      const missing = parts[i].length - r.value
      if (missing > 0) errors.push(`${missing} row(s) were skipped because their receipt number belongs to another school`)
      return
    }
    console.error('[fees bulk import] chunk failed', r.reason)
    const rows = parts[i].map(p => p.row)
    errors.push(`Rows ${rows[0]}–${rows[rows.length - 1]}: could not be saved (duplicate or invalid data)`)
  })
  return saved
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((session.user as any).role !== 'management') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { type, records } = body

    if (!type || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Invalid payload. Must provide type ("structures" | "payments") and non-empty records array.' }, { status: 400 })
    }

    // Always the session's school — a schoolId in the body is ignored.
    const targetSchoolId = requireSchool(session)
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    if (type === 'structures') {
      const parsed: Array<{ row: number; value: NewFeeStructure }> = []
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

          parsed.push({ row: i + 1, value: {
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
          } })
        } catch {
          errors.push(`Row ${i + 1}: invalid data`)
          failedCount++
        }
      }
      // fee_structures has no natural unique key, so this is a plain multi-row insert.
      successCount = await insertChunks(parsed, async (part) => {
        const rows = await db.insert(feeStructures).values(part.map(p => p.value)).returning({ id: feeStructures.id })
        return rows.length
      }, errors)
      failedCount += parsed.length - successCount
    } else if (type === 'payments') {
      // Pre-fetch students & fee structures for fast matching
      const allStudents = await listStudents({ schoolId: targetSchoolId })
      const allStructures = await listFeeStructures({ schoolId: targetSchoolId })
      const studentByRoll = new Map<string, (typeof allStudents)[number]>()
      const studentByName = new Map<string, (typeof allStudents)[number]>()
      for (const st of allStudents) {
        if (st.rollNo && !studentByRoll.has(st.rollNo.toLowerCase())) studentByRoll.set(st.rollNo.toLowerCase(), st)
        const n = st.name?.toLowerCase().trim()
        if (n && !studentByName.has(n)) studentByName.set(n, st)
      }
      const structureByName = new Map(allStructures.map(f => [f.name.toLowerCase().trim(), f]))

      // Rows with a receipt number from the file are upserted on the unique
      // receipt_number (re-importing a sheet updates instead of failing);
      // rows without one get a generated, collision-resistant receipt.
      const withReceipt = new Map<string, { row: number; value: NewFeePayment }>()
      const generated: Array<{ row: number; value: NewFeePayment }> = []
      const year = new Date().getFullYear()

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
          let matchedStudent = rollNo ? studentByRoll.get(rollNo.toLowerCase()) : undefined
          if (!matchedStudent && studentNameRaw) {
            matchedStudent = studentByName.get(studentNameRaw.toLowerCase())
          }

          const resolvedStudentId = matchedStudent ? matchedStudent.id : null
          const resolvedStudentName = matchedStudent ? matchedStudent.name : (studentNameRaw || `Student (${rollNo})`)
          const resolvedRollNo = matchedStudent ? (matchedStudent.rollNo || rollNo) : rollNo

          // Match fee structure by Name
          const matchedStructure = structureByName.get(feeStructureName.toLowerCase())
          const resolvedStructureId = matchedStructure ? matchedStructure.id : null
          const resolvedFeeType = matchedStructure ? (matchedStructure.feeType || 'Monthly Tuition') : (row['Fee Category'] || row.feeType || 'Monthly Tuition')

          const discount = Math.round(Number(row['Discount'] ?? row.discount ?? 0))
          const lateFee = Math.round(Number(row['Late Fee'] ?? row.lateFee ?? 0))
          const paymentMethod = (row['Payment Method'] || row.paymentMethod || 'UPI').toString().trim()
          const transactionId = (row['Transaction ID'] || row.transactionId || '').toString().trim()
          
          const suppliedReceipt = (row['Receipt Number'] || row.receiptNumber || '').toString().trim()
          const receiptNumber = suppliedReceipt
            || `REC-${year}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`

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

          const value: NewFeePayment = {
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
          }
          if (suppliedReceipt) {
            const earlier = withReceipt.get(suppliedReceipt)
            if (earlier) {
              errors.push(`Row ${earlier.row}: duplicate Receipt Number ${suppliedReceipt} in this file; row ${i + 1} was used`)
              failedCount++
            }
            withReceipt.set(suppliedReceipt, { row: i + 1, value })
          } else {
            generated.push({ row: i + 1, value })
          }
        } catch {
          errors.push(`Row ${i + 1}: invalid data`)
          failedCount++
        }
      }

      const upserted = await insertChunks([...withReceipt.values()], async (part) => {
        const rows = await db.insert(feePayments).values(part.map(p => p.value))
          .onConflictDoUpdate({
            target: feePayments.receiptNumber,
            set: {
              studentId: sql.raw('excluded.student_id'),
              studentName: sql.raw('excluded.student_name'),
              rollNo: sql.raw('excluded.roll_no'),
              class: sql.raw('excluded.class'),
              section: sql.raw('excluded.section'),
              feeStructureId: sql.raw('excluded.fee_structure_id'),
              feeName: sql.raw('excluded.fee_name'),
              feeType: sql.raw('excluded.fee_type'),
              amountDue: sql.raw('excluded.amount_due'),
              amountPaid: sql.raw('excluded.amount_paid'),
              discount: sql.raw('excluded.discount'),
              lateFee: sql.raw('excluded.late_fee'),
              paymentMethod: sql.raw('excluded.payment_method'),
              transactionId: sql.raw('excluded.transaction_id'),
              dueDate: sql.raw('excluded.due_date'),
              paidDate: sql.raw('excluded.paid_date'),
              status: sql.raw('excluded.status'),
              notes: sql.raw('excluded.notes'),
              updatedAt: sql`now()`,
            },
            // never overwrite another school's payment that happens to share a receipt number
            setWhere: sql`"fee_payments"."school_id" = excluded.school_id`,
          })
          .returning({ id: feePayments.id })
        return rows.length
      }, errors)
      const inserted = await insertChunks(generated, async (part) => {
        const rows = await db.insert(feePayments).values(part.map(p => p.value)).returning({ id: feePayments.id })
        return rows.length
      }, errors)
      successCount = upserted + inserted
      failedCount += withReceipt.size + generated.length - successCount
    }

    return NextResponse.json({
      successCount,
      failedCount,
      errors: errors.slice(0, 10), // Return top 10 errors for feedback
      message: `Successfully imported ${successCount} ${type === 'structures' ? 'fee structures' : 'payment records'} into Neon Postgres.`
    }, { status: 201 })
  } catch (error) {
    return errorResponse(error, 'POST /api/fees/bulk-import')
  }
}
