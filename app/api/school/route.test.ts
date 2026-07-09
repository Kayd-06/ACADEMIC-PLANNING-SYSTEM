import { db } from '@/lib/db'
import { schools } from '@/lib/db/schema'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { GET, PATCH } from './route'

describe('GET /api/school', () => {
  afterEach(async () => {
    await db.delete(schools)
  })

  it('returns school details by session schoolId', async () => {
    const [school] = await db.insert(schools).values({ name: 'Academic Planning System' }).returning()
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user', role: 'management', schoolId: school.id } })
    
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.name).toBe('Academic Planning System')
  })
})

describe('PATCH /api/school', () => {
  afterEach(async () => {
    await db.delete(schools)
  })

  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const req = new Request('http://localhost/api/school', {
      method: 'PATCH',
      body: JSON.stringify({ board: 'ICSE Affiliated' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('rejects when the session role is not management', async () => {
    const [school] = await db.insert(schools).values({ name: 'School' }).returning()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: school.id } })
    const req = new Request('http://localhost/api/school', {
      method: 'PATCH',
      body: JSON.stringify({ board: 'ICSE Affiliated' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('updates the school when the session role is management', async () => {
    const [school] = await db.insert(schools).values({ name: 'Old School' }).returning()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const req = new Request('http://localhost/api/school', {
      method: 'PATCH',
      body: JSON.stringify({ board: 'ICSE Affiliated' }),
    })
    const res = await PATCH(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.board).toBe('ICSE Affiliated')
  })
})
