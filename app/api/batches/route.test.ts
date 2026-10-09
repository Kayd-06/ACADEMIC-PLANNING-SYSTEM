import { db } from '@/lib/db'
import { batches, schools, faculty, teacherBatches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { POST, PATCH, GET } from './route'

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
    const [school] = await db.insert(schools).values({ name: 'Batch PATCH School' }).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({
      name: 'Batch A', capacity: 60, classLevel: '11', schoolId: school.id,
    }).returning()
    createdIds.batches.push(batch.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const body = {
      name: 'Batch A', classLevel: '', capacity: '60',
      startDate: '2024-01-01', endDate: '2024-12-31', programId: '', teacherId: '',
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
    const [school] = await db.insert(schools).values({ name: 'Batch POST School' }).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const body = {
      name: 'New Batch No Class Level', classLevel: '', capacity: '60',
      startDate: '2024-01-01', endDate: '2024-12-31', programId: '', teacherId: '',
    }
    const res = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    const json = await res.json()
    if (res.status === 201) createdIds.batches.push(json.id)

    expect(res.status).toBe(201)
    expect(json.classLevel).toBe('')
  })
})

describe('unique batch name validation', () => {
  it('rejects creating a batch whose name already exists in the same school', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    createdIds.schools.push(school.id)
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })

    const body = { name: 'Morning', classLevel: '', capacity: '60', startDate: '2026-01-01', endDate: '', programId: '', teacherId: '' }
    const first = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    const firstJson = await first.json()
    expect(first.status).toBe(201)
    createdIds.batches.push(firstJson.id)

    const second = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    expect(second.status).toBe(409)
  })

  it('allows the same batch name in two different schools', async () => {
    const [schoolA] = await db.insert(schools).values({}).returning()
    const [schoolB] = await db.insert(schools).values({}).returning()
    createdIds.schools.push(schoolA.id, schoolB.id)

    const body = { name: 'Evening', classLevel: '', capacity: '60', startDate: '2026-01-01', endDate: '', programId: '', teacherId: '' }

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const resA = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    const jsonA = await resA.json()
    expect(resA.status).toBe(201)
    createdIds.batches.push(jsonA.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolB.id } })
    const resB = await POST(jsonReq('http://localhost/api/batches', 'POST', body))
    const jsonB = await resB.json()
    expect(resB.status).toBe(201)
    createdIds.batches.push(jsonB.id)
  })

  it('rejects renaming a batch to a name already used by another batch in the same school', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    createdIds.schools.push(school.id)
    const [batchOne] = await db.insert(batches).values({ name: 'Batch One', schoolId: school.id }).returning()
    const [batchTwo] = await db.insert(batches).values({ name: 'Batch Two', schoolId: school.id }).returning()
    createdIds.batches.push(batchOne.id, batchTwo.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const body = { name: 'Batch One', classLevel: '', capacity: '60', startDate: '2026-01-01', endDate: '', programId: '', teacherId: '' }
    const res = await PATCH(jsonReq(`http://localhost/api/batches?id=${batchTwo.id}`, 'PATCH', body))
    expect(res.status).toBe(409)

    const [unchanged] = await db.select().from(batches).where(eq(batches.id, batchTwo.id))
    expect(unchanged.name).toBe('Batch Two')
  })

  it('allows saving a batch with its own unchanged name', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    createdIds.schools.push(school.id)
    const [batch] = await db.insert(batches).values({ name: 'Steady', schoolId: school.id, classLevel: '9' }).returning()
    createdIds.batches.push(batch.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const body = { name: 'Steady', classLevel: '10', capacity: '60', startDate: '2026-01-01', endDate: '', programId: '', teacherId: '' }
    const res = await PATCH(jsonReq(`http://localhost/api/batches?id=${batch.id}`, 'PATCH', body))
    expect(res.status).toBe(200)
  })
})

describe('requires an active school', () => {
  it('POST is refused (403) for an account without a school instead of creating a school-less batch', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })
    const res = await POST(jsonReq('http://localhost/api/batches', 'POST', { name: 'X', startDate: '2024-01-01' }))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/batches - teacher isolation', () => {
  it('allows teachers to only see batches they are assigned to', async () => {
    const [school] = await db.insert(schools).values({ name: 'Teacher Batch School' }).returning()
    createdIds.schools.push(school.id)

    const [teacher] = await db.insert(faculty).values({
      name: 'Teacher 1', email: 't1@example.com', role: 'TEACHER', schoolId: school.id, isActive: true, subject: 'Math', specialization: 'Algebra'
    }).returning()

    const [b1] = await db.insert(batches).values({
      name: 'Batch 1', classLevel: '', capacity: 60, startDate: '2024-01-01', endDate: '2024-12-31', schoolId: school.id
    }).returning()
    createdIds.batches.push(b1.id)

    const [b2] = await db.insert(batches).values({
      name: 'Batch 2', classLevel: '', capacity: 60, startDate: '2024-01-01', endDate: '2024-12-31', schoolId: school.id
    }).returning()
    createdIds.batches.push(b2.id)

    await db.insert(teacherBatches).values({
      teacherId: teacher.id, batchName: b1.name
    })

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, role: 'TEACHER', email: 't1@example.com', schoolId: school.id } })
    
    // We import GET inside the test so it re-evaluates or just call it directly.
    const req = new Request('http://localhost/api/batches') as any
    const res = await GET(req)
    const json = await res.json()
    console.log('JSON RESPONSE:', json);
    const returnedIds = Array.isArray(json) ? json.map((b: any) => b.id) : []

    expect(returnedIds).toContain(b1.id)
    expect(returnedIds).not.toContain(b2.id)
  })
})
