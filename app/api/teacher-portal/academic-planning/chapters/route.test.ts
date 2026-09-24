import { db } from '@/lib/db'
import { batches, subjects, chapters, batchSyllabus, schools, programs, adminSchools, users } from '@/lib/db/schema'
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

// The "users" table is in the DB guard's protected list, so the afterEach's
// unscoped db.delete(users) is a silent no-op (see lib/db/dbGuard.ts) and
// rows persist across test runs. A fixed literal email would therefore
// collide with a leftover row on the second run, so each invocation gets a
// unique one instead of relying on cleanup.
async function makeAdmin(emailPrefix: string, accessibleSchoolIds: string[]) {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`
  const [user] = await db.insert(users).values({ name: 'Test Admin', email, password: 'x', role: 'management' }).returning()
  if (accessibleSchoolIds.length > 0) {
    await db.insert(adminSchools).values(accessibleSchoolIds.map(schoolId => ({ userId: user.id, schoolId })))
  }
  return user
}

describe('teacher-portal/academic-planning/chapters', () => {
  afterEach(async () => {
    await db.delete(batchSyllabus)
    await db.delete(chapters)
    await db.delete(subjects)
    await db.delete(batches)
    await db.delete(programs)
    await db.delete(adminSchools)
    await db.delete(users)
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

  it('bulk import routes each row to the school its own Excel column names, not the upload-wide default', async () => {
    const schoolA = await makeSchool('School A')
    const schoolB = await makeSchool('School B')
    const admin = await makeAdmin('admin', [schoolA.id, schoolB.id])
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: admin.id, role: 'management', schoolId: schoolA.id } })

    const res = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({
        className: 'JEE 1',
        subject: 'Biology',
        items: [
          { title: 'Row for School A', batch: 'JEE 1', subject: 'Biology', school: 'School A', estHours: '5', status: 'NOT STARTED' },
          { title: 'Row for School B', batch: 'NEET 1', subject: 'Biology', school: 'School B', estHours: '8', status: 'COMPLETED' },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.errors).toEqual([])

    const [chapA] = await db.select().from(chapters).where(eq(chapters.name, 'Row for School A'))
    const [chapB] = await db.select().from(chapters).where(eq(chapters.name, 'Row for School B'))
    expect(chapA.schoolId).toBe(schoolA.id)
    expect(chapB.schoolId).toBe(schoolB.id)

    const [batchB] = await db.select().from(batches).where(eq(batches.name, 'NEET 1'))
    expect(batchB.schoolId).toBe(schoolB.id)
  })

  it('bulk import skips a row naming a school the session cannot access, and reports it instead of silently mis-filing it', async () => {
    const schoolA = await makeSchool('School A')
    await makeSchool('Unrelated School') // exists, but this admin has no access to it
    const admin = await makeAdmin('admin2', [schoolA.id])
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: admin.id, role: 'management', schoolId: schoolA.id } })

    const res = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({
        className: 'JEE 1',
        subject: 'Biology',
        items: [
          { title: 'Good Row', batch: 'JEE 1', subject: 'Biology', school: 'School A', estHours: '5', status: 'NOT STARTED' },
          { title: 'Bad Row', batch: 'JEE 1', subject: 'Biology', school: 'Unrelated School', estHours: '5', status: 'NOT STARTED' },
        ],
      }),
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].title).toBe('Bad Row')

    const goodChap = await db.select().from(chapters).where(eq(chapters.name, 'Good Row'))
    const badChap = await db.select().from(chapters).where(eq(chapters.name, 'Bad Row'))
    expect(goodChap).toHaveLength(1)
    expect(badChap).toHaveLength(0)
  })

  it('bulk import auto-creates a Program named in the Excel row and links it to the new batch it creates', async () => {
    const school = await makeSchool('School A')
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'management', schoolId: school.id } })

    const res = await POST(req('http://localhost/api/teacher-portal/academic-planning/chapters', {
      method: 'POST',
      body: JSON.stringify({
        className: 'NEET 1',
        subject: 'Biology',
        items: [
          { title: 'Cells', batch: 'NEET 1', subject: 'Biology', program: 'NEET', estHours: '10', status: 'NOT STARTED' },
        ],
      }),
    }))
    expect(res.status).toBe(200)

    const [newBatch] = await db.select().from(batches).where(eq(batches.name, 'NEET 1'))
    expect(newBatch.programId).toBeTruthy()

    const [program] = await db.select().from(programs).where(eq(programs.id, newBatch.programId!))
    expect(program.name).toBe('NEET')
    expect(program.schoolId).toBe(school.id)
  })
})
