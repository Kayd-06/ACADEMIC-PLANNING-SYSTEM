import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  feeStructures,
  feePayments,
  type FeeStructure,
  type NewFeeStructure,
  type FeePayment,
  type NewFeePayment
} from '../schema'

export interface ListFeeStructuresFilters {
  schoolId?: string | null
  isActive?: boolean
  search?: string
}

export async function listFeeStructures(filters: ListFeeStructuresFilters = {}): Promise<FeeStructure[]> {
  const conditions: any[] = []
  if (filters.isActive !== undefined) {
    conditions.push(eq(feeStructures.isActive, filters.isActive))
  }
  if (filters.schoolId) {
    conditions.push(eq(feeStructures.schoolId, filters.schoolId))
  }
  if (filters.search && filters.search.trim() !== '') {
    const s = `%${filters.search.trim()}%`
    conditions.push(
      or(
        ilike(feeStructures.name, s),
        ilike(feeStructures.feeType, s),
        ilike(feeStructures.programAssociation, s),
        ilike(feeStructures.batchAssociation, s),
        ilike(feeStructures.description, s)
      )
    )
  }

  if (conditions.length === 0) {
    return db.select().from(feeStructures).orderBy(desc(feeStructures.createdAt))
  }
  return db
    .select()
    .from(feeStructures)
    .where(and(...conditions))
    .orderBy(desc(feeStructures.createdAt))
}

export async function getFeeStructureById(id: string): Promise<FeeStructure | null> {
  const rows = await db.select().from(feeStructures).where(eq(feeStructures.id, id))
  return rows[0] ?? null
}

export async function createFeeStructure(data: NewFeeStructure): Promise<FeeStructure> {
  const rows = await db.insert(feeStructures).values(data).returning()
  return rows[0]
}

export async function updateFeeStructure(id: string, data: Partial<NewFeeStructure>): Promise<FeeStructure | null> {
  const rows = await db
    .update(feeStructures)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(feeStructures.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteFeeStructure(id: string): Promise<boolean> {
  const result = await db.delete(feeStructures).where(eq(feeStructures.id, id)).returning()
  return result.length > 0
}

export interface ListFeePaymentsFilters {
  schoolId?: string | null
  status?: string
  search?: string
  studentId?: string
  feeStructureId?: string
}

export async function listFeePayments(filters: ListFeePaymentsFilters = {}): Promise<FeePayment[]> {
  const conditions: any[] = []
  if (filters.schoolId) {
    conditions.push(eq(feePayments.schoolId, filters.schoolId))
  }
  if (filters.status && filters.status !== 'All') {
    conditions.push(eq(feePayments.status, filters.status))
  }
  if (filters.studentId) {
    conditions.push(eq(feePayments.studentId, filters.studentId))
  }
  if (filters.feeStructureId) {
    conditions.push(eq(feePayments.feeStructureId, filters.feeStructureId))
  }
  if (filters.search && filters.search.trim() !== '') {
    const s = `%${filters.search.trim()}%`
    conditions.push(
      or(
        ilike(feePayments.studentName, s),
        ilike(feePayments.rollNo, s),
        ilike(feePayments.feeName, s),
        ilike(feePayments.receiptNumber, s),
        ilike(feePayments.transactionId, s)
      )
    )
  }

  if (conditions.length === 0) {
    return db.select().from(feePayments).orderBy(desc(feePayments.createdAt))
  }
  return db
    .select()
    .from(feePayments)
    .where(and(...conditions))
    .orderBy(desc(feePayments.createdAt))
}

export async function getFeePaymentById(id: string): Promise<FeePayment | null> {
  const rows = await db.select().from(feePayments).where(eq(feePayments.id, id))
  return rows[0] ?? null
}

export async function createFeePayment(data: NewFeePayment): Promise<FeePayment> {
  const rows = await db.insert(feePayments).values(data).returning()
  return rows[0]
}

export async function updateFeePayment(id: string, data: Partial<NewFeePayment>): Promise<FeePayment | null> {
  const rows = await db
    .update(feePayments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(feePayments.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteFeePayment(id: string): Promise<boolean> {
  const result = await db.delete(feePayments).where(eq(feePayments.id, id)).returning()
  return result.length > 0
}

export async function computeFeeStats(schoolId?: string | null) {
  const conditions: any[] = []
  if (schoolId) {
    conditions.push(eq(feePayments.schoolId, schoolId))
  }

  const allPayments = conditions.length > 0 
    ? await db.select().from(feePayments).where(and(...conditions))
    : await db.select().from(feePayments)

  // Calculate dynamic stats exactly from rows
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  let totalCollectedThisMonth = 0
  let totalCollectedAllTime = 0
  let pendingDues = 0
  let overdueAccounts = 0
  const studentsWithDuesSet = new Set<string>()

  let totalAmountExpected = 0

  for (const p of allPayments) {
    const netDue = (p.amountDue || 0) + (p.lateFee || 0) - (p.discount || 0)
    const paid = p.amountPaid || 0
    totalCollectedAllTime += paid
    totalAmountExpected += netDue

    // Check if paid in current month
    if (p.paidDate) {
      const pDate = new Date(p.paidDate)
      if (!isNaN(pDate.getTime()) && pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
        totalCollectedThisMonth += paid
      }
    } else if (p.createdAt) {
      const cDate = new Date(p.createdAt)
      if (cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear && p.status === 'Paid') {
        totalCollectedThisMonth += paid
      }
    }

    // Check dues
    const remaining = Math.max(0, netDue - paid)
    if (remaining > 0 && p.status !== 'Waived' && p.status !== 'Paid') {
      pendingDues += remaining
      if (p.studentId) {
        studentsWithDuesSet.add(p.studentId)
      } else {
        studentsWithDuesSet.add(p.studentName)
      }
    }

    if (p.status === 'Overdue') {
      overdueAccounts += 1
    } else if (remaining > 0 && p.dueDate) {
      const dueDt = new Date(p.dueDate)
      if (!isNaN(dueDt.getTime()) && dueDt < now && p.status !== 'Waived') {
        overdueAccounts += 1
      }
    }
  }

  const activeStudentsWithDuesCount = studentsWithDuesSet.size
  const collectionRate = totalAmountExpected > 0 
    ? Math.round((totalCollectedAllTime / totalAmountExpected) * 100) 
    : 100

  return {
    totalCollectedThisMonth,
    totalCollectedAllTime,
    pendingDues,
    activeStudentsWithDuesCount,
    overdueAccounts,
    collectionRate,
    totalPaymentRecordsCount: allPayments.length
  }
}
