import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockCountDocuments = jest.fn()
const mockDeleteMany = jest.fn()
const mockInsertMany = jest.fn()
const mockFind = jest.fn()
jest.mock('@/models/Attendance', () => ({
  __esModule: true,
  default: {
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
    deleteMany: (...args: any[]) => mockDeleteMany(...args),
    insertMany: (...args: any[]) => mockInsertMany(...args),
    find: (...args: any[]) => ({ lean: () => mockFind(...args) }),
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

describe('GET /api/attendance/overview', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance/overview'))
    expect(res.status).toBe(401)
  })

  it('seeds 250 Postgres students when the target classes are not already populated, then computes metrics from Mongo sheets', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    mockCountDocuments.mockResolvedValue(0) // forces the historical re-seed branch
    mockDeleteMany.mockResolvedValue({})
    mockInsertMany.mockResolvedValue([])
    mockFind.mockResolvedValue([])

    const res = await GET(req('http://localhost/api/attendance/overview?range=30'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overallRate).toBe(92.4) // fallback when there are no sheets at all
    expect(body.heatmap).toHaveLength(30)

    const rows = await db.select().from(students)
    expect(rows).toHaveLength(250)
  })

  it('does not reseed students when the target class count is already 250', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management' } })
    await db.insert(students).values(
      Array.from({ length: 250 }, (_, i) => ({ name: `S${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    mockCountDocuments.mockResolvedValue(150) // sheet count > 100, skips attendance re-seed too
    mockFind.mockResolvedValue([])

    await GET(req('http://localhost/api/attendance/overview'))

    expect(mockDeleteMany).not.toHaveBeenCalled()
    expect(mockInsertMany).not.toHaveBeenCalled()
  })
})
