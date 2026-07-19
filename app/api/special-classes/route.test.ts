import { db } from '@/lib/db'
import { specialClasses, schools, programs, batches } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => {
    const schoolId = session?.user?.schoolId
    if (!schoolId || schoolId === 'null' || schoolId === 'undefined' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
      return null
    }
    return schoolId
  },
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

const createdIds = {
  specialClasses: [] as string[],
  batches: [] as string[],
  programs: [] as string[],
  schools: [] as string[],
}

afterEach(async () => {
  for (const id of createdIds.specialClasses) await db.delete(specialClasses).where(eq(specialClasses.id, id))
  for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
  for (const id of createdIds.programs) await db.delete(programs).where(eq(programs.id, id))
  for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

describe('GET /api/special-classes', () => {
  it('never leaks another school\'s special classes into a management view', async () => {
    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    createdIds.schools.push(schoolA.id)
    const [schoolB] = await db.insert(schools).values({ name: 'School B' }).returning()
    createdIds.schools.push(schoolB.id)

    const [scA] = await db.insert(specialClasses).values({
      title: 'Revision A', teacherEmail: 't-a@example.com', date: '2026-08-01',
      startTime: '10:00 AM', endTime: '11:00 AM', schoolId: schoolA.id,
    }).returning()
    createdIds.specialClasses.push(scA.id)
    const [scB] = await db.insert(specialClasses).values({
      title: 'Revision B', teacherEmail: 't-b@example.com', date: '2026-08-02',
      startTime: '11:00 AM', endTime: '12:00 PM', schoolId: schoolB.id,
    }).returning()
    createdIds.specialClasses.push(scB.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const res = await GET(req('http://localhost/api/special-classes'))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).toEqual([scA.id])
  })

  it('filtering by programId narrows to only that program\'s linked batches', async () => {
    const [school] = await db.insert(schools).values({ name: 'Program Filter School' }).returning()
    createdIds.schools.push(school.id)

    const [program] = await db.insert(programs).values({ name: 'NEET', schoolId: school.id }).returning()
    createdIds.programs.push(program.id)
    const [linkedBatch] = await db.insert(batches).values({ name: 'Linked Batch', capacity: 60, classLevel: '11', schoolId: school.id, programId: program.id }).returning()
    createdIds.batches.push(linkedBatch.id)
    const [unlinkedBatch] = await db.insert(batches).values({ name: 'Unlinked Batch', capacity: 60, classLevel: '11', schoolId: school.id }).returning()
    createdIds.batches.push(unlinkedBatch.id)

    const [scLinked] = await db.insert(specialClasses).values({
      title: 'Doubt Session', teacherEmail: 't1@example.com', batch: 'Linked Batch',
      date: '2026-08-01', startTime: '10:00 AM', endTime: '11:00 AM', schoolId: school.id,
    }).returning()
    createdIds.specialClasses.push(scLinked.id)
    const [scUnlinked] = await db.insert(specialClasses).values({
      title: 'Makeup Class', teacherEmail: 't2@example.com', batch: 'Unlinked Batch',
      date: '2026-08-02', startTime: '11:00 AM', endTime: '12:00 PM', schoolId: school.id,
    }).returning()
    createdIds.specialClasses.push(scUnlinked.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const res = await GET(req(`http://localhost/api/special-classes?programId=${program.id}`))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).toEqual([scLinked.id])
  })
})
