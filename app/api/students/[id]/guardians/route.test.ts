import { db } from '@/lib/db'
import { students, parentsGuardians } from '@/lib/db/schema'
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

const createdIds = { guardians: [] as string[], students: [] as string[] }

afterEach(async () => {
  for (const id of createdIds.guardians) await db.delete(parentsGuardians).where(eq(parentsGuardians.id, id))
  for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

async function makeStudent() {
  const [student] = await db.insert(students).values({ name: 'Test Student', class: '11 - A' }).returning()
  createdIds.students.push(student.id)
  return student
}

describe('POST /api/students/[id]/guardians — phone validation', () => {
  it('rejects a phone number that is not exactly 10 digits', async () => {
    const student = await makeStudent()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const res = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian A', phone: '12345' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/10 digits/)
  })

  it('rejects adding a second guardian with a phone already used by another guardian on the same student', async () => {
    const student = await makeStudent()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const first = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian A', phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const firstJson = await first.json()
    createdIds.guardians.push(firstJson.id)

    const second = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian B', phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const secondJson = await second.json()

    expect(second.status).toBe(409)
    expect(secondJson.error).toMatch(/already exists/)
  })

  it('allows the same phone number across two different students', async () => {
    const studentA = await makeStudent()
    const studentB = await makeStudent()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const resA = await POST(
      jsonReq(`http://localhost/api/students/${studentA.id}/guardians`, 'POST', { name: 'Guardian A', phone: '9876543210' }),
      { params: Promise.resolve({ id: studentA.id }) }
    )
    createdIds.guardians.push((await resA.json()).id)

    const resB = await POST(
      jsonReq(`http://localhost/api/students/${studentB.id}/guardians`, 'POST', { name: 'Guardian B', phone: '9876543210' }),
      { params: Promise.resolve({ id: studentB.id }) }
    )
    const jsonB = await resB.json()
    if (resB.status === 201) createdIds.guardians.push(jsonB.id)

    expect(resB.status).toBe(201)
  })
})

describe('PATCH /api/students/[id]/guardians — phone validation', () => {
  it('allows re-saving a guardian with its own unchanged phone number', async () => {
    const student = await makeStudent()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const created = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian A', phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const guardian = await created.json()
    createdIds.guardians.push(guardian.id)

    const res = await PATCH(
      jsonReq(`http://localhost/api/students/${student.id}/guardians?guardianId=${guardian.id}`, 'PATCH', { name: 'Guardian A Updated', phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    expect(res.status).toBe(200)
  })

  it('rejects editing a guardian to use a phone number another guardian on the same student already has', async () => {
    const student = await makeStudent()
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const g1res = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian A', phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const g1 = await g1res.json()
    createdIds.guardians.push(g1.id)

    const g2res = await POST(
      jsonReq(`http://localhost/api/students/${student.id}/guardians`, 'POST', { name: 'Guardian B', phone: '9123456780' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const g2 = await g2res.json()
    createdIds.guardians.push(g2.id)

    const res = await PATCH(
      jsonReq(`http://localhost/api/students/${student.id}/guardians?guardianId=${g2.id}`, 'PATCH', { phone: '9876543210' }),
      { params: Promise.resolve({ id: student.id }) }
    )
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/already exists/)
  })
})
