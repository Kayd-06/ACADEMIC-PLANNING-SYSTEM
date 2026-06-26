import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockPaymentFind = jest.fn()
const mockPaymentFindOne = jest.fn()
const mockPaymentCreate = jest.fn()
jest.mock('@/models/PaymentRecord', () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => ({ sort: () => ({ lean: () => mockPaymentFind(...args) }) }),
    findOne: (...args: any[]) => mockPaymentFindOne(...args),
    create: (...args: any[]) => mockPaymentCreate(...args),
  },
}))

const mockFeeTypeFindById = jest.fn()
jest.mock('@/models/FeeType', () => ({
  __esModule: true,
  default: {
    findById: (...args: any[]) => mockFeeTypeFindById(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

describe('GET /api/fees/payments', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/payments'))
    expect(res.status).toBe(401)
  })

  it('returns whatever PaymentRecord.find resolves', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockPaymentFind.mockResolvedValue([{ studentName: 'A' }])
    const res = await GET(req('http://localhost/api/fees/payments'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([{ studentName: 'A' }])
  })
})

describe('POST /api/fees/payments', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when the role is not management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await POST(req('http://localhost/api/fees/payments', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the Postgres student does not exist', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000000', feeTypeId: 'x', amount: 100 }),
      })
    )
    expect(res.status).toBe(404)
  })

  it('creates a new payment record using the real Postgres student name/rollNo/class', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    const [student] = await db.insert(students).values({ name: 'Fee Payer', rollNo: '001', class: '11 - A', section: 'A' }).returning()
    mockFeeTypeFindById.mockResolvedValue({ _id: 'feetype1', name: 'Tuition', amount: 1000 })
    mockPaymentFindOne.mockResolvedValue(null)
    mockPaymentCreate.mockImplementation(async (data: any) => data)

    const res = await POST(
      req('http://localhost/api/fees/payments', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.id, feeTypeId: 'feetype1', amount: 1000 }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: student.id, studentName: 'Fee Payer', rollNo: '001', class: '11 - A', section: 'A' })
    )
    expect(body.status).toBe('Paid')
  })
})
