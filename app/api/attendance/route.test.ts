import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockFindOne = jest.fn()
const mockFindOneAndUpdate = jest.fn()
jest.mock('@/models/Attendance', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => ({ lean: () => mockFindOne(...args) }),
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
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

describe('GET /api/attendance', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    expect(res.status).toBe(401)
  })

  it('rejects when required query params are missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/attendance'))
    expect(res.status).toBe(400)
  })

  it('returns the existing sheet when one is already marked', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values(
      Array.from({ length: 12 }, (_, i) => ({ name: `Student ${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    const existingSheet = { date: '2026-01-01', batch: '11 - A', subject: 'Physics', records: [] }
    mockFindOne.mockResolvedValue(existingSheet)

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(existingSheet)
  })

  it('builds a default record template from real Postgres students when no sheet exists', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values(
      Array.from({ length: 12 }, (_, i) => ({ name: `Student ${i}`, class: '11 - A', rollNo: String(i), isActive: true }))
    )
    mockFindOne.mockResolvedValue(null)

    const res = await GET(req('http://localhost/api/attendance?date=2026-01-01&batch=11 - A&subject=Physics'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isNew).toBe(true)
    expect(body.records).toHaveLength(12)
    expect(typeof body.records[0].studentId).toBe('string')
    expect(body.records[0].studentId.length).toBeGreaterThan(20)
  })
})

describe('POST /api/attendance', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects when the role is not teacher or management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/attendance', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('upserts the attendance sheet with the given records', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const saved = { date: '2026-01-01', batch: '11 - A', subject: 'Physics', classTime: '09:00 AM - 10:00 AM', records: [] }
    mockFindOneAndUpdate.mockResolvedValue(saved)

    const res = await POST(
      req('http://localhost/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-01-01',
          batch: '11 - A',
          subject: 'Physics',
          records: [{ studentId: 'some-uuid', studentName: 'A', rollNo: '1', status: 'Present' }],
        }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(saved)
    expect(mockFindOneAndUpdate).toHaveBeenCalled()
  })
})
