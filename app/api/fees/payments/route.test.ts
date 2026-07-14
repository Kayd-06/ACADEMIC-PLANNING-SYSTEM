import { db } from '@/lib/db'
import { students, feeStructures, feePayments } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

const createdStudentIds: string[] = []
const createdFeeStructureIds: string[] = []
const createdPaymentIds: string[] = []

describe('GET /api/fees/payments', () => {
  afterEach(async () => {
    if (createdPaymentIds.length > 0) {
      await db.delete(feePayments).where(inArray(feePayments.id, createdPaymentIds))
      createdPaymentIds.length = 0
    }
    if (createdFeeStructureIds.length > 0) {
      await db.delete(feeStructures).where(inArray(feeStructures.id, createdFeeStructureIds))
      createdFeeStructureIds.length = 0
    }
    if (createdStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, createdStudentIds))
      createdStudentIds.length = 0
    }
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/payments'))
    expect(res.status).toBe(401)
  })

  it('returns payment records for management session', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const [student] = await db.insert(students).values({ name: 'Payment Student', rollNo: '101', class: '11 - A', section: 'A' }).returning()
    createdStudentIds.push(student.id)

    const [structure] = await db.insert(feeStructures).values({ name: 'Tuition Fee', amount: 5000, frequency: 'Monthly' }).returning()
    createdFeeStructureIds.push(structure.id)

    const [payment] = await db.insert(feePayments).values({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      class: student.class,
      section: student.section,
      feeStructureId: structure.id,
      feeName: structure.name,
      amountDue: 5000,
      amountPaid: 5000,
      status: 'Paid',
      paymentMethod: 'UPI',
      receiptNumber: `REC-${Date.now()}`,
      dueDate: '2026-01-31'
    }).returning()
    createdPaymentIds.push(payment.id)

    const res = await GET(req(`http://localhost/api/fees/payments?studentId=${student.id}`))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    const found = body.find((r: any) => r._id === payment.id)
    expect(found).toBeDefined()
    expect(found.studentName).toBe('Payment Student')
  })
})

describe('POST /api/fees/payments', () => {
  afterEach(async () => {
    if (createdPaymentIds.length > 0) {
      await db.delete(feePayments).where(inArray(feePayments.id, createdPaymentIds))
      createdPaymentIds.length = 0
    }
    if (createdFeeStructureIds.length > 0) {
      await db.delete(feeStructures).where(inArray(feeStructures.id, createdFeeStructureIds))
      createdFeeStructureIds.length = 0
    }
    if (createdStudentIds.length > 0) {
      await db.delete(students).where(inArray(students.id, createdStudentIds))
      createdStudentIds.length = 0
    }
    jest.clearAllMocks()
  })

  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/fees/payments', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the Postgres student does not exist', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [structure] = await db.insert(feeStructures).values({ name: 'Test Fee', amount: 100 }).returning()
    createdFeeStructureIds.push(structure.id)

    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000000', feeStructureId: structure.id, amount: 100 }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('creates a new payment record using real Postgres student and feeStructure', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const [student] = await db.insert(students).values({ name: 'Fee Payer', rollNo: '001', class: '11 - A', section: 'A' }).returning()
    createdStudentIds.push(student.id)

    const [structure] = await db.insert(feeStructures).values({ name: 'Tuition', amount: 1000, frequency: 'Monthly' }).returning()
    createdFeeStructureIds.push(structure.id)

    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id, feeStructureId: structure.id, amountPaid: 1000 }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.status).toBe('Paid')
    if (body.id) createdPaymentIds.push(body.id)
  })
})
