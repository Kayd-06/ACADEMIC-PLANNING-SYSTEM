jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET } from './route'

describe('GET /api/recruitment/orientations (Postgres)', () => {
  it('requires a session (the Mongo version was public and seeded demo rows)', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })

  it('is management-only', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: '11111111-1111-1111-1111-111111111111' } })
    expect((await GET()).status).toBe(403)
  })
})
