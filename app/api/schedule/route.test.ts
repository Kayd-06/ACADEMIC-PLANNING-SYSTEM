import { db } from '@/lib/db'
import { classSchedules, schools, programs, batches } from '@/lib/db/schema'
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

// Scoped-by-ID cleanup only — never db.delete(table) with no WHERE.
const createdIds = {
  classSchedules: [] as string[],
  batches: [] as string[],
  programs: [] as string[],
  schools: [] as string[],
}

afterEach(async () => {
  for (const id of createdIds.classSchedules) await db.delete(classSchedules).where(eq(classSchedules.id, id))
  for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
  for (const id of createdIds.programs) await db.delete(programs).where(eq(programs.id, id))
  for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

describe('GET /api/schedule', () => {
  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/schedule'))
    expect(res.status).toBe(401)
  })

  it('never leaks another school\'s weekly schedule slots into a management view', async () => {
    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    createdIds.schools.push(schoolA.id)
    const [schoolB] = await db.insert(schools).values({ name: 'School B' }).returning()
    createdIds.schools.push(schoolB.id)

    const [slotA] = await db.insert(classSchedules).values({
      teacherEmail: 'teacher-a@example.com', subject: 'Physics', batch: 'Batch A',
      dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', schoolId: schoolA.id,
    }).returning()
    createdIds.classSchedules.push(slotA.id)
    const [slotB] = await db.insert(classSchedules).values({
      teacherEmail: 'teacher-b@example.com', subject: 'Chemistry', batch: 'Batch B',
      dayOfWeek: 2, startTime: '10:00 AM', endTime: '11:00 AM', schoolId: schoolB.id,
    }).returning()
    createdIds.classSchedules.push(slotB.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const res = await GET(req('http://localhost/api/schedule'))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).toEqual([slotA.id])
  })

  it('a malformed session schoolId does not fall through to showing every school\'s slots', async () => {
    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    createdIds.schools.push(schoolA.id)

    const [slotA] = await db.insert(classSchedules).values({
      teacherEmail: 'teacher-a@example.com', subject: 'Physics', batch: 'Batch A',
      dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', schoolId: schoolA.id,
    }).returning()
    createdIds.classSchedules.push(slotA.id)

    // Legacy/malformed schoolId (not a UUID) — getSchoolId() should treat this as null,
    // and management with a null schoolId should see only school-less (null) slots, not School A's.
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: 'not-a-uuid' } })
    const res = await GET(req('http://localhost/api/schedule'))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).not.toContain(slotA.id)
  })

  it('filtering by batch name narrows to that batch\'s slots only', async () => {
    const [school] = await db.insert(schools).values({ name: 'Filter School' }).returning()
    createdIds.schools.push(school.id)

    const [slot1] = await db.insert(classSchedules).values({
      teacherEmail: 't1@example.com', subject: 'Physics', batch: 'Grade 11-A',
      dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', schoolId: school.id,
    }).returning()
    createdIds.classSchedules.push(slot1.id)
    const [slot2] = await db.insert(classSchedules).values({
      teacherEmail: 't2@example.com', subject: 'Chemistry', batch: 'Grade 11-B',
      dayOfWeek: 2, startTime: '10:00 AM', endTime: '11:00 AM', schoolId: school.id,
    }).returning()
    createdIds.classSchedules.push(slot2.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const res = await GET(req(`http://localhost/api/schedule?batch=${encodeURIComponent('Grade 11-A')}`))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).toEqual([slot1.id])
  })

  it('filtering by programId narrows to only that program\'s linked batches', async () => {
    const [school] = await db.insert(schools).values({ name: 'Program Filter School' }).returning()
    createdIds.schools.push(school.id)

    const [program] = await db.insert(programs).values({ name: 'JEE Integrated', schoolId: school.id }).returning()
    createdIds.programs.push(program.id)
    const [linkedBatch] = await db.insert(batches).values({ name: 'Linked Batch', capacity: 60, classLevel: '11', schoolId: school.id, programId: program.id }).returning()
    createdIds.batches.push(linkedBatch.id)
    const [unlinkedBatch] = await db.insert(batches).values({ name: 'Unlinked Batch', capacity: 60, classLevel: '11', schoolId: school.id }).returning()
    createdIds.batches.push(unlinkedBatch.id)

    const [slotLinked] = await db.insert(classSchedules).values({
      teacherEmail: 't1@example.com', subject: 'Physics', batch: 'Linked Batch',
      dayOfWeek: 1, startTime: '09:00 AM', endTime: '10:00 AM', schoolId: school.id,
    }).returning()
    createdIds.classSchedules.push(slotLinked.id)
    const [slotUnlinked] = await db.insert(classSchedules).values({
      teacherEmail: 't2@example.com', subject: 'Chemistry', batch: 'Unlinked Batch',
      dayOfWeek: 2, startTime: '10:00 AM', endTime: '11:00 AM', schoolId: school.id,
    }).returning()
    createdIds.classSchedules.push(slotUnlinked.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: school.id } })
    const res = await GET(req(`http://localhost/api/schedule?programId=${program.id}`))
    const body = await res.json()

    expect(body.map((s: any) => s._id)).toEqual([slotLinked.id])
  })
})
