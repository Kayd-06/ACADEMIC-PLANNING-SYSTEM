jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST, DELETE } from './route'

const req = (url: string, init?: RequestInit) => new Request(url, init)

describe('/api/academic-planning (Postgres)', () => {
  it('requires a session (the Mongo version was public)', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/academic-planning?role=teacher'))
    expect(res.status).toBe(401)
  })

  it('rejects a missing board role', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: '11111111-1111-1111-1111-111111111111' } })
    const res = await GET(req('http://localhost/api/academic-planning'))
    expect(res.status).toBe(400)
  })

  it('does not let a teacher read the management board', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher', schoolId: '11111111-1111-1111-1111-111111111111' } })
    const res = await GET(req('http://localhost/api/academic-planning?role=management'))
    expect(res.status).toBe(403)
  })

  it('refuses without an active school', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'teacher' } })
    const res = await GET(req('http://localhost/api/academic-planning?role=teacher'))
    expect(res.status).toBe(403)
  })

  it('validates modelType and required fields before writing', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: '11111111-1111-1111-1111-111111111111' } })
    const bad = await POST(req('http://localhost/api/academic-planning', { method: 'POST', body: JSON.stringify({ modelType: 'metric', role: 'management' }) }))
    expect(bad.status).toBe(400)
    const missing = await POST(req('http://localhost/api/academic-planning', { method: 'POST', body: JSON.stringify({ modelType: 'milestone', role: 'management', name: 'X' }) }))
    expect(missing.status).toBe(400)
  })

  it('requires id and type to delete', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: '11111111-1111-1111-1111-111111111111' } })
    const res = await DELETE(req('http://localhost/api/academic-planning?id=abc', { method: 'DELETE' }))
    expect(res.status).toBe(400)
  })
})
