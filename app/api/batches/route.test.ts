import { db } from '@/lib/db'
import { batches, schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { POST, PATCH } from './route'

function jsonReq(url: string, method: string, body: any) {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

const createdIds = { batches: [] as string[], schools: [] as string[] }

afterEach(async () => {
  for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
  for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

describe('PATCH /api/batches — Unassigned coordinator / no class level', () => {
  it('saves successfully when class level is unset and coordinator is Unassigned', async () => {
    const [batch] = await db.insert(batches).values({
      name: 'Batch A', capacity: 60, classLevel: '11', schoolId: null,
    }).returning()
    createdIds.batches.push(batch.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const body = {
      name: 'Batch A', classLevel: '', capacity: '60',
      startDate: '', endDate: '', programId: '', teacherId: '',
    }
    const res = await PATCH(jsonReq(`http://localhost/api/batches?id=${batch.id}`, 'PATCH', body))
    const json = await res.json()

    expect(res.status).toBe(200)
    // class_level is NOT NULL DEFAULT '' — clearing the selection must map
    // back to '', not null, or the update violates that column constraint.
    expect(json.classLevel).toBe('')
    expect(json.teacherId).toBeNull()
  })
})

describe('POST /api/batches — same Unassigned / no class level combination', () => {
  it('creates successfully when class level is unset and coordinator is Unassigned', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const body = {
      name: 'New Batch No Class Level', classLevel: '', capacity: '60',
      startDate: '', endDate: '', programId: '', teacherId: '',
    }
    const res = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    const json = await res.json()
    if (res.status === 201) createdIds.batches.push(json.id)

    expect(res.status).toBe(201)
    expect(json.classLevel).toBe('')
  })
})
