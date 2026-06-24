import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockFeeTypeCount = jest.fn()
const mockFeeTypeInsertMany = jest.fn()
jest.mock('@/models/FeeType', () => ({
  __esModule: true,
  default: {
    countDocuments: (...args: any[]) => mockFeeTypeCount(...args),
    insertMany: (...args: any[]) => mockFeeTypeInsertMany(...args),
  },
}))

const mockPaymentInsertMany = jest.fn()
const mockPaymentFind = jest.fn()
const mockPaymentCount = jest.fn()
jest.mock('@/models/PaymentRecord', () => ({
  __esModule: true,
  default: {
    insertMany: (...args: any[]) => mockPaymentInsertMany(...args),
    find: (...args: any[]) => mockPaymentFind(...args),
    countDocuments: (...args: any[]) => mockPaymentCount(...args),
  },
}))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/fees/stats', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/stats'))
    expect(res.status).toBe(401)
  })

  it('seeds 60 Postgres students when fewer than 50 active students exist, then returns computed metrics', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockFeeTypeCount.mockResolvedValue(0) // triggers the seed branch
    mockFeeTypeInsertMany.mockImplementation(async (docs: any[]) => docs.map((d, i) => ({ ...d, _id: `fee${i}` })))
    mockPaymentInsertMany.mockResolvedValue([])
    mockPaymentFind.mockResolvedValue([])
    mockPaymentCount.mockResolvedValue(0)

    const res = await GET(req('http://localhost/api/fees/stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      totalCollectedThisMonth: 0,
      pendingDues: 0,
      activeStudentsWithDuesCount: 0,
      overdueAccounts: 0,
      collectionRate: 0,
    })

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(60)
  })

  it('does not reseed FeeType/students when FeeType already has rows', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockFeeTypeCount.mockResolvedValue(5)
    mockPaymentFind.mockResolvedValue([])
    mockPaymentCount.mockResolvedValue(0)

    await GET(req('http://localhost/api/fees/stats'))

    expect(mockFeeTypeInsertMany).not.toHaveBeenCalled()
    const rows = await db.select().from(students)
    expect(rows).toHaveLength(0)
  })
})
