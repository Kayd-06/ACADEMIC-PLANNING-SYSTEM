import { db } from '@/lib/db'
import { students } from '@/lib/db/schema'
import { GET } from './route'

function req() {
  return new Request('http://localhost/api/students/roster') as any
}

describe('GET /api/students/roster', () => {
  afterEach(async () => {
    await db.delete(students)
  })

  it('returns real program and batch values when set', async () => {
    await db.insert(students).values({ name: 'Has Program', program: 'JEE 2026', batch: 'Morning', class: '11 - A', section: 'A' })

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body[0].program).toBe('JEE 2026')
    expect(body[0].batch).toBe('Morning')
  })

  it('falls back to Unassigned when program and batch are empty', async () => {
    await db.insert(students).values({ name: 'No Program' })

    const res = await GET(req())
    const body = await res.json()

    expect(body[0].program).toBe('Unassigned')
    expect(body[0].batch).toBe('Unassigned')
  })
})
