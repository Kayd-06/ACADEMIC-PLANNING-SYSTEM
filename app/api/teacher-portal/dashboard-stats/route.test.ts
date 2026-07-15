import { db } from '@/lib/db'
import { classSchedules, dailyReports, assignments, assignmentSubmissions, tests, students, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getSchoolId: (session: any) => session?.user?.schoolId ?? null,
}))
jest.mock('@/lib/scheduleUtils', () => {
  const actual = jest.requireActual('@/lib/scheduleUtils')
  return { ...actual, getLocalToday: () => '2026-08-10' }
})

import { auth } from '@/lib/auth'
import { GET } from './route'

// Scoped-by-ID cleanup only — never db.delete(table) with no WHERE. This
// project has no separate test database; an unscoped delete here would
// remove real rows from every other teacher's schedule/assignments too.
const createdIds = {
  classSchedules: [] as string[],
  dailyReports: [] as string[],
  assignments: [] as string[],
  assignmentSubmissions: [] as string[],
  tests: [] as string[],
  students: [] as string[],
  users: [] as string[],
}

afterEach(async () => {
  for (const id of createdIds.assignmentSubmissions) await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.id, id))
  for (const id of createdIds.assignments) await db.delete(assignments).where(eq(assignments.id, id))
  for (const id of createdIds.classSchedules) await db.delete(classSchedules).where(eq(classSchedules.id, id))
  for (const id of createdIds.dailyReports) await db.delete(dailyReports).where(eq(dailyReports.id, id))
  for (const id of createdIds.tests) await db.delete(tests).where(eq(tests.id, id))
  for (const id of createdIds.students) await db.delete(students).where(eq(students.id, id))
  for (const id of createdIds.users) await db.delete(users).where(eq(users.id, id))
  Object.values(createdIds).forEach(arr => (arr.length = 0))
  jest.clearAllMocks()
})

function req() {
  return new Request('http://localhost/api/teacher-portal/dashboard-stats') as any
}

describe('GET /api/teacher-portal/dashboard-stats', () => {
  it('rejects when there is no session', async () => {
    ;(auth as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('rejects non-teacher roles', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { email: 'x@example.com', role: 'management' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('counts a today-scheduled class with no submitted report as pending', async () => {
    const email = `dash-stats-${Date.now()}@example.com`
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: '00000000-0000-0000-0000-000000000001', email, role: 'teacher', schoolId: null } })

    const [sched] = await db.insert(classSchedules).values({
      teacherEmail: email, subject: 'Physics', batch: 'Batch A', dayOfWeek: new Date('2026-08-10T00:00:00Z').getUTCDay(),
      startTime: '10:00 AM', endTime: '11:00 AM', isActive: true,
    }).returning()
    createdIds.classSchedules.push(sched.id)

    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pendingDailyReports).toBe(1)
  })

  it('does not count a class that already has a submitted report today', async () => {
    const email = `dash-stats-${Date.now()}@example.com`
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: '00000000-0000-0000-0000-000000000001', email, role: 'teacher', schoolId: null } })

    const [sched] = await db.insert(classSchedules).values({
      teacherEmail: email, subject: 'Physics', batch: 'Batch A', dayOfWeek: new Date('2026-08-10T00:00:00Z').getUTCDay(),
      startTime: '10:00 AM', endTime: '11:00 AM', isActive: true,
    }).returning()
    createdIds.classSchedules.push(sched.id)

    const [report] = await db.insert(dailyReports).values({
      teacherName: 'T', teacherEmail: email, date: '2026-08-10', batch: 'Batch A', subject: 'Physics',
    }).returning()
    createdIds.dailyReports.push(report.id)

    const res = await GET()
    const body = await res.json()
    expect(body.pendingDailyReports).toBe(0)
  })

  it('counts submitted-but-ungraded assignment submissions, not graded ones', async () => {
    const email = `dash-stats-${Date.now()}@example.com`
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: '00000000-0000-0000-0000-000000000001', email, role: 'teacher', schoolId: null } })

    const [assignment] = await db.insert(assignments).values({
      title: 'HW1', chapter: 'Ch1', batch: 'Batch A', subject: 'Physics', dueDate: '2026-08-10', teacherEmail: email,
    }).returning()
    createdIds.assignments.push(assignment.id)

    const [student] = await db.insert(students).values({ name: 'S1', batch: 'Batch A' }).returning()
    createdIds.students.push(student.id)

    const [sub1] = await db.insert(assignmentSubmissions).values({
      assignmentId: assignment.id, studentId: student.id, status: 'Submitted',
    }).returning()
    createdIds.assignmentSubmissions.push(sub1.id)

    const [sub2] = await db.insert(assignmentSubmissions).values({
      assignmentId: assignment.id, studentId: student.id, status: 'Graded',
    }).returning()
    createdIds.assignmentSubmissions.push(sub2.id)

    const res = await GET()
    const body = await res.json()
    expect(body.assignmentsToGrade).toBe(1)
  })

  it('counts only this teacher\'s own Upcoming tests', async () => {
    const [teacher] = await db.insert(users).values({
      name: 'T1', email: `dash-owner-${Date.now()}@example.com`, password: 'x', role: 'teacher',
    }).returning()
    createdIds.users.push(teacher.id)
    const [otherTeacher] = await db.insert(users).values({
      name: 'T2', email: `dash-other-${Date.now()}@example.com`, password: 'x', role: 'teacher',
    }).returning()
    createdIds.users.push(otherTeacher.id)

    const [myTest] = await db.insert(tests).values({
      title: 'Mine', batch: 'Batch A', subject: 'Physics', date: '2026-08-20', createdByUserId: teacher.id, status: 'Upcoming',
    }).returning()
    createdIds.tests.push(myTest.id)
    const [otherTest] = await db.insert(tests).values({
      title: 'Not mine', batch: 'Batch A', subject: 'Physics', date: '2026-08-20', createdByUserId: otherTeacher.id, status: 'Upcoming',
    }).returning()
    createdIds.tests.push(otherTest.id)
    const [gradedTest] = await db.insert(tests).values({
      title: 'Already graded', batch: 'Batch A', subject: 'Physics', date: '2026-08-01', createdByUserId: teacher.id, status: 'Graded',
    }).returning()
    createdIds.tests.push(gradedTest.id)

    ;(auth as jest.Mock).mockResolvedValue({ user: { id: teacher.id, email: teacher.email, role: 'teacher', schoolId: null } })
    const res = await GET()
    const body = await res.json()
    expect(body.upcomingTests).toBe(1)
  })
})
