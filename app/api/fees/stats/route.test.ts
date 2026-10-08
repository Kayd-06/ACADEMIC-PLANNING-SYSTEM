import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

describe('GET /api/fees/stats', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/fees/stats'))
    expect(res.status).toBe(401)
  })

  it('refuses (403) when the account has no active school instead of aggregating every school', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const res = await GET(req('http://localhost/api/fees/stats?schoolId=00000000-0000-0000-0000-000000000001'))
    expect(res.status).toBe(403)
  })

  it('returns computed metrics when session is present', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: '00000000-0000-0000-0000-0000000000f5' } })

    const res = await GET(req('http://localhost/api/fees/stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('totalCollectedThisMonth')
    expect(body).toHaveProperty('pendingDues')
    expect(body).toHaveProperty('activeStudentsWithDuesCount')
    expect(body).toHaveProperty('overdueAccounts')
    expect(body).toHaveProperty('collectionRate')
  })
})
