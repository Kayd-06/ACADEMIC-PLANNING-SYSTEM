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
import { buildFeeStudentMatcher, importReceiptNumber, occurrenceCounter } from '@/lib/fees/importMatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CHUNK_SIZE = 100
const CONCURRENCY = 3

type Parsed<V> = { row: number; value: V }

/**
 * Write parsed rows in chunks of 100 (3 at a time), one statement per chunk.
 * `write` returns the rows it could not save together with the reason; a
 * chunk that throws is retried row by row so only the bad rows fail.
 */
async function writeChunks<V>(
  items: Parsed<V>[],
  write: (part: Parsed<V>[]) => Promise<Array<{ item: Parsed<V>; reason: string }>>,
  errors: string[],
): Promise<number> {
  const parts = chunk(items, CHUNK_SIZE)
  const results = await mapWithConcurrency(parts, CONCURRENCY, write)
  let saved = 0
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      saved += parts[i].length - r.value.length
      for (const m of r.value) errors.push(`Row ${m.item.row}: ${m.reason}`)
      continue
    }
    console.error('[fees bulk import] chunk failed, retrying row by row', r.reason)
    const single = await mapWithConcurrency(parts[i], CONCURRENCY, (item) => write([item]))
    single.forEach((res, j) => {
      if (res.status === 'fulfilled') {
        saved += 1 - res.value.length
        for (const m of res.value) errors.push(`Row ${m.item.row}: ${m.reason}`)
      } else {
        errors.push(`Row ${parts[i][j].row}: could not be saved (check amounts, dates and text lengths)`)
      }
    })
  }
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
      successCount = await writeChunks(parsed, async (part) => {
        await db.insert(feeStructures).values(part.map(p => p.value))
        return []
      }, errors)
      failedCount += parsed.length - successCount
    } else if (type === 'payments') {
      // Pre-fetch students & fee structures for fast matching
      const allStudents = await listStudents({ schoolId: targetSchoolId })
      const allStructures = await listFeeStructures({ schoolId: targetSchoolId })
      const matchStudent = buildFeeStudentMatcher(allStudents)
      const structureByName = new Map(allStructures.map(f => [f.name.toLowerCase().trim(), f]))

      // Every row is upserted on the unique receipt_number, so re-importing a
      // sheet updates instead of duplicating. Rows without a receipt number
      // get a deterministic one (school + student + fee + dates + amounts +
      // n-th identical row in the file), not a random one.
      const byReceipt = new Map<string, Parsed<NewFeePayment>>()
      const nextOccurrence = occurrenceCounter()

      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        try {
          const rollNo = (row['Student Roll No'] || row['Roll No'] || row.rollNo || '').toString().trim()
          const admissionNumber = (row['Admission Number'] || row['Admission No'] || row.admissionNumber || '').toString().trim()
          const classCell = (row['Class'] || row.class || '').toString().trim()
          const sectionCell = (row['Section'] || row.section || '').toString().trim()
          const studentNameRaw = (row['Student Name'] || row.studentName || '').toString().trim()
          const feeStructureName = (row['Fee Structure Name'] || row['Fee Name'] || row.feeName || '').toString().trim()
          const amountDueStr = row['Amount Due'] ?? row.amountDue ?? 0
          const amountPaidStr = row['Amount Paid'] ?? row.amountPaid ?? 0
          const amountDue = Math.round(Number(amountDueStr))
          const amountPaid = Math.round(Number(amountPaidStr))

          if (!studentNameRaw && !rollNo && !admissionNumber) {
            errors.push(`Row ${i + 1}: Missing Admission Number, Student Roll No and Student Name`)
            failedCount++
            continue
          }
          if (!feeStructureName) {
            errors.push(`Row ${i + 1}: Missing Fee Structure Name`)
            failedCount++
            continue
          }

          // Admission number, then roll + class (+ section); a bare roll number
          // or name only when unique in the school (roll numbers repeat across classes).
          const match = matchStudent({ admissionNumber, rollNo, class: classCell, section: sectionCell, name: studentNameRaw })
          if (match.kind === 'ambiguous') {
            errors.push(`Row ${i + 1}: ${match.message}`)
            failedCount++
            continue
          }
          const matchedStudent = match.kind === 'matched' ? match.student : undefined

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
          
          const nowStr = new Date().toISOString().split('T')[0]
          const dueDateCell = (row['Due Date'] || row.dueDate || '').toString().trim()
          const paidDateCell = (row['Paid Date'] || row.paidDate || '').toString().trim()
          const dueDate = dueDateCell || nowStr
          const paidDate = paidDateCell || (amountPaid > 0 ? nowStr : '')

          const suppliedReceipt = (row['Receipt Number'] || row.receiptNumber || '').toString().trim()
          let receiptNumber = suppliedReceipt
          if (!receiptNumber) {
            const parts = {
              schoolId: targetSchoolId,
              student: matchedStudent ? matchedStudent.id : `${studentNameRaw}|${rollNo}|${admissionNumber}`,
              fee: resolvedStructureId ?? feeStructureName,
              dueDate: dueDateCell,
              paidDate: paidDateCell,
              amountDue: isNaN(amountDue) ? -1 : amountDue,
              amountPaid: isNaN(amountPaid) ? 0 : amountPaid,
            }
            receiptNumber = importReceiptNumber(parts, nextOccurrence(parts))
          }

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
          const earlier = byReceipt.get(receiptNumber)
          if (earlier) {
            errors.push(`Row ${earlier.row}: duplicate Receipt Number ${receiptNumber} in this file; row ${i + 1} was used`)
            failedCount++
          }
          byReceipt.set(receiptNumber, { row: i + 1, value })
        } catch {
          errors.push(`Row ${i + 1}: invalid data`)
          failedCount++
        }
      }

      const rowsToWrite = [...byReceipt.values()]
      successCount = await writeChunks(rowsToWrite, async (part) => {
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
          .returning({ receiptNumber: feePayments.receiptNumber })
        // A row missing from RETURNING was skipped by setWhere: its receipt
        // number is already used by another school's payment.
        const saved = new Set(rows.map(r => r.receiptNumber))
        return part
          .filter(p => !saved.has(p.value.receiptNumber))
          .map(item => ({ item, reason: `Receipt Number ${item.value.receiptNumber} is already used by another school's record` }))
      }, errors)
      failedCount += rowsToWrite.length - successCount
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
