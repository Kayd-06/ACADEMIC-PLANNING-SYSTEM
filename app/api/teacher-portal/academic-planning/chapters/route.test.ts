import { db } from '@/lib/db'
import { batches, subjects, chapters, batchSyllabus, schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

import { auth } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

async function makeSchool(name: string) {
  const [school] = await db.insert(schools).values({ name }).returning()
  return school
}

describe('teacher-portal/academic-planning/chapters', () => {
  afterEach(async () => {
    await db.delete(batchSyllabus)
    await db.delete(chapters)
    await db.delete(subjects)
    await db.delete(batches)
    await db.delete(schools)
    jest.clearAllMocks()
  })

  it('GET rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/teacher-portal/academic-planning/chapters?class=Grade%2011-A&subject=Physics'))
    expect(res.status).toBe(401)
  })

  it('POST creates a chapter scoped to the caller\'s school', async () => {
    const school = await makeSchool('School A')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'management', schoolId: school.id } })

    const res = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({ className: 'Grade 11-A', subject: 'Physics', title: 'Kinematics', estHours: '10', dates: 'Aug 15 - Aug 28', status: 'NOT STARTED' }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.chapter.title).toBe('Kinematics')

    const [createdBatch] = await db.select().from(batches).where(eq(batches.name, 'Grade 11-A'))
    expect(createdBatch.schoolId).toBe(school.id)
  })

  it('two schools with the same batch/subject names get separate chapter lists, not a shared one', async () => {
    const schoolA = await makeSchool('School A')
    const schoolB = await makeSchool('School B')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uA', role: 'management', schoolId: schoolA.id } })
    await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({ className: 'Grade 11-A', subject: 'Physics', title: 'School A Chapter', estHours: '10', dates: 'Aug 15 - Aug 28', status: 'NOT STARTED' }),
    }))

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uB', role: 'management', schoolId: schoolB.id } })
    const resB = await GET(req('http://localhost/api/teacher-portal/academic-planning/chapters?class=Grade%2011-A&subject=Physics'))
    const bodyB = await resB.json()

    expect(bodyB.chapters).toHaveLength(0)
    expect(bodyB.chapters.some((c: any) => c.title === 'School A Chapter')).toBe(false)
  })

  it('PATCH rejects a status update from a different school (404)', async () => {
    const schoolA = await makeSchool('School A')
    const schoolB = await makeSchool('School B')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uA', role: 'management', schoolId: schoolA.id } })
    const createRes = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({ className: 'Grade 11-A', subject: 'Physics', title: 'Kinematics', estHours: '10', dates: 'Aug 15 - Aug 28', status: 'NOT STARTED' }),
    }))
    const { chapter } = await createRes.json()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uB', role: 'management', schoolId: schoolB.id } })
    const patchRes = await PATCH(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'PATCH',
      body: JSON.stringify({ id: chapter._id, status: 'COMPLETED' }),
    }))
    expect(patchRes.status).toBe(404)

    const [row] = await db.select().from(batchSyllabus).where(eq(batchSyllabus.id, chapter._id))
    expect(row.status).toBe('Not Started')
  })

  it('DELETE rejects a delete from a different school (404), row survives', async () => {
    const schoolA = await makeSchool('School A')
    const schoolB = await makeSchool('School B')

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uA', role: 'management', schoolId: schoolA.id } })
    const createRes = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({ className: 'Grade 11-A', subject: 'Physics', title: 'Kinematics', estHours: '10', dates: 'Aug 15 - Aug 28', status: 'NOT STARTED' }),
    }))
    const { chapter } = await createRes.json()

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'uB', role: 'management', schoolId: schoolB.id } })
    const delRes = await DELETE(req(`http://localhost/api/teacher-portal/academic-planning/chapters?id=${chapter._id}`, { method: 'DELETE' }))
    expect(delRes.status).toBe(404)

    const stillThere = await db.select().from(batchSyllabus).where(eq(batchSyllabus.id, chapter._id))
    expect(stillThere).toHaveLength(1)
  })

  it('a status change persists and is visible to another session in the same school (the actual sync path)', async () => {
    const school = await makeSchool('School A')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'management', schoolId: school.id } })

    const createRes = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({ className: 'Grade 11-A', subject: 'Physics', title: 'Kinematics', estHours: '10', dates: 'Aug 15 - Aug 28', status: 'NOT STARTED' }),
    }))
    const { chapter } = await createRes.json()

    // Simulate the faculty side making a status change.
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u2', role: 'teacher', schoolId: school.id } })
    await PATCH(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'PATCH',
      body: JSON.stringify({ id: chapter._id, status: 'COMPLETED' }),
    }))

    // Admin re-fetches and sees the faculty's change.
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'management', schoolId: school.id } })
    const getRes = await GET(req('http://localhost/api/teacher-portal/academic-planning/chapters?class=Grade%2011-A&subject=Physics'))
    const body = await getRes.json()
    expect(body.chapters.find((c: any) => c._id === chapter._id).status).toBe('COMPLETED')
  })
})
