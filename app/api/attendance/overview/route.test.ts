import { db } from '@/lib/db'
import { students, attendanceSessions, attendanceEntries, programs, batches, schools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))

import { auth } from '@/lib/auth'
import { GET } from './route'

function req(url: string) {
  return new Request(url) as any
}

// Scoped-by-ID cleanup only — never db.delete(table) with no WHERE. The DB
// Guard blocks unscoped deletes on students/schools (returns as if it
// succeeded, but leaves the rows in place), and doesn't cover
// attendance_sessions/attendance_entries/batches/programs/batch_programs at
// all, so relying on it here would either silently no-op or actually wipe
// shared data.
const createdIds = {
  attendanceEntries: [] as string[],
  attendanceSessions: [] as string[],
  students: [] as string[],
  batches: [] as string[],
  programs: [] as string[],
  schools: [] as string[],
}

afterEach(async () => {
  for (const id of createdIds.attendanceEntries) await db.delete(attendanceEntries).where(eq(attendanceEntries.id, id))
  for (const id of createdIds.attendanceSessions) await db.delete(attendanceSessions).where(eq(attendanceSessions.id, id))
  for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
  for (const id of createdIds.batches) await db.delete(batches).where(eq(batches.id, id))
  for (const id of createdIds.programs) await db.delete(programs).where(eq(programs.id, id))
  for (const id of createdIds.schools) await db.delete(schools).where(eq(schools.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

describe('GET /api/attendance/overview', () => {
  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/attendance/overview'))
    expect(res.status).toBe(401)
  })

  it('computes metrics from Postgres sessions and entries', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const [student] = await db.insert(students).values({
      name: 'Student A', class: '11 - A', batch: 'Grade 11-A', program: 'JEE Integrated', isActive: true,
    }).returning()
    createdIds.students.push(student.id)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    const [session] = await db.insert(attendanceSessions).values({
      date: dateStr, batch: 'Grade 11-A', subject: 'Physics',
    }).returning()
    createdIds.attendanceSessions.push(session.id)

    const [entry] = await db.insert(attendanceEntries).values({
      sessionId: session.id, studentName: 'Student A', status: 'Present',
    }).returning()
    createdIds.attendanceEntries.push(entry.id)

    const res = await GET(req('http://localhost/api/attendance/overview?range=7'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overallRate).toBe(100)
  })

  it('distinctBatches includes a batch with zero enrolled students', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    // A batch entity with no students at all — the old students-derived
    // dropdown source would never surface this one.
    const [emptyBatch] = await db.insert(batches).values({ name: 'Empty Batch', capacity: 60, classLevel: '11', schoolId: null }).returning()
    createdIds.batches.push(emptyBatch.id)
    const [populatedBatch] = await db.insert(batches).values({ name: 'Populated Batch', capacity: 60, classLevel: '11', schoolId: null }).returning()
    createdIds.batches.push(populatedBatch.id)

    const [student] = await db.insert(students).values({ name: 'Student A', class: '11 - A', batch: 'Populated Batch', isActive: true }).returning()
    createdIds.students.push(student.id)

    const res = await GET(req('http://localhost/api/attendance/overview?range=7'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.distinctBatches).toEqual(['Empty Batch', 'Populated Batch'])
  })

  it('never leaks another school\'s programs or batches into the dropdown options', async () => {
    const [schoolA] = await db.insert(schools).values({ name: 'School A' }).returning()
    createdIds.schools.push(schoolA.id)
    const [schoolB] = await db.insert(schools).values({ name: 'School B' }).returning()
    createdIds.schools.push(schoolB.id)

    const [progA] = await db.insert(programs).values({ name: 'School A Program', schoolId: schoolA.id }).returning()
    createdIds.programs.push(progA.id)
    const [progB] = await db.insert(programs).values({ name: 'School B Program', schoolId: schoolB.id }).returning()
    createdIds.programs.push(progB.id)

    const [batchA] = await db.insert(batches).values({ name: 'School A Batch', capacity: 60, classLevel: '11', schoolId: schoolA.id }).returning()
    createdIds.batches.push(batchA.id)
    const [batchB] = await db.insert(batches).values({ name: 'School B Batch', capacity: 60, classLevel: '11', schoolId: schoolB.id }).returning()
    createdIds.batches.push(batchB.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: schoolA.id } })
    const res = await GET(req('http://localhost/api/attendance/overview?range=7'))
    const body = await res.json()

    expect(body.distinctPrograms).toEqual(['School A Program'])
    expect(body.distinctBatches).toEqual(['School A Batch'])
  })

  it('filtering by program narrows batches to only that program\'s linked batches', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { role: 'management', schoolId: null } })

    const [program] = await db.insert(programs).values({ name: 'JEE Integrated', schoolId: null }).returning()
    createdIds.programs.push(program.id)
    const [linkedBatch] = await db.insert(batches).values({ name: 'Linked Batch', capacity: 60, classLevel: '11', schoolId: null, programId: program.id }).returning()
    createdIds.batches.push(linkedBatch.id)
    const [unlinkedBatch] = await db.insert(batches).values({ name: 'Unlinked Batch', capacity: 60, classLevel: '11', schoolId: null }).returning()
    createdIds.batches.push(unlinkedBatch.id)

    const res = await GET(req(`http://localhost/api/attendance/overview?range=7&program=${encodeURIComponent('JEE Integrated')}`))
    const body = await res.json()

    expect(body.distinctBatches).toEqual(['Linked Batch'])
  })
})
