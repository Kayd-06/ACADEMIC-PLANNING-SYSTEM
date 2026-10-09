jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET } from './route'
import { GET as scheduleGET, PATCH as schedulePATCH } from './schedule/route'

describe('/api/teacher-portal (Postgres)', () => {
  it('requires a session (the Mongo version was public and seeded demo rows)', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await scheduleGET(new Request('http://localhost/api/teacher-portal/schedule'))).status).toBe(401)
  })

  it('refuses users without a school', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    expect((await GET()).status).toBe(403)
  })

  it('requires an id to update a schedule item', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: '11111111-1111-1111-1111-111111111111' } })
    const res = await schedulePATCH(new Request('http://localhost/api/teacher-portal/schedule', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
