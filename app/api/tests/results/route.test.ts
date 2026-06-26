import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/mongodb', () => ({
  connectDB: jest.fn(),
}))

const mockTestFindById = jest.fn()
const mockTestFindOne = jest.fn()
const mockTestCreate = jest.fn()
const mockTestFindByIdAndUpdate = jest.fn()
jest.mock('@/models/Test', () => ({
  __esModule: true,
  default: {
    findById: (...args: any[]) => mockTestFindById(...args),
    findOne: (...args: any[]) => mockTestFindOne(...args),
    create: (...args: any[]) => mockTestCreate(...args),
    findByIdAndUpdate: (...args: any[]) => mockTestFindByIdAndUpdate(...args),
  },
}))

const mockResultFindOne = jest.fn()
const mockResultFindOneAndUpdate = jest.fn()
const mockResultCreate = jest.fn()
jest.mock('@/models/TestResult', () => ({
  __esModule: true,
  default: {
    findOne: (...args: any[]) => mockResultFindOne(...args),
    findOneAndUpdate: (...args: any[]) => mockResultFindOneAndUpdate(...args),
    create: (...args: any[]) => mockResultCreate(...args),
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

describe('GET /api/tests/results', () => {
  afterEach(async () => {
    await db.delete(students)
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/tests/results?testId=t1'))
    expect(res.status).toBe(401)
  })

  it('rejects when testId is missing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/tests/results'))
    expect(res.status).toBe(400)
  })

  it('builds a template from real Postgres students for a Pending test with no saved results yet', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    await db.insert(students).values({ name: 'Test Taker', class: '11 - A', rollNo: '001', isActive: true })
    mockTestFindById.mockResolvedValue({ _id: 't1', batch: '11 - A', title: 'Quiz 1', totalMarks: 100, status: 'Pending' })
    mockResultFindOne.mockResolvedValue(null)

    const res = await GET(req('http://localhost/api/tests/results?testId=t1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.isNew).toBe(true)
    expect(body.studentResults).toHaveLength(1)
    expect(typeof body.studentResults[0].studentId).toBe('string')
    expect(body.studentResults[0].studentId.length).toBeGreaterThan(20)
  })
})

describe('POST /api/tests/results', () => {
  afterEach(() => jest.clearAllMocks())

  it('rejects when the role is not teacher or management', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'student' } })
    const res = await POST(req('http://localhost/api/tests/results', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(403)
  })

  it('saves results and updates the test status to Graded', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    mockTestFindById.mockResolvedValue({ _id: 't1', totalMarks: 100, toObject: () => ({ _id: 't1', totalMarks: 100 }) })
    mockResultFindOneAndUpdate.mockResolvedValue({ studentResults: [] })
    mockTestFindByIdAndUpdate.mockResolvedValue({})

    const res = await POST(
      req('http://localhost/api/tests/results', {
        method: 'POST',
        body: JSON.stringify({
          testId: 't1',
          studentResults: [{ studentId: 'some-uuid', studentName: 'A', rollNo: '1', marksObtained: 80, absent: false }],
        }),
      })
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockTestFindByIdAndUpdate).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'Graded' }))
  })
})
