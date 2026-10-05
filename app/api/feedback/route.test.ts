import { db } from '@/lib/db'
import { feedback, schools, faculty } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/notify', () => ({ notifyRoleInSchool: jest.fn(), notifyUsers: jest.fn() }))

import { auth } from '@/lib/auth'
import { GET, POST } from './route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as any
}

function asUser(user: Record<string, unknown> | null) {
  ;(auth as jest.Mock).mockResolvedValue(user ? { user } : null)
}

function postBody(body: unknown) {
  return req('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const today = () => new Date().toISOString().slice(0, 10)

const schoolIds: string[] = []
const nullSchoolRowIds: string[] = []

async function makeSchool() {
  const [s] = await db.insert(schools).values({ name: 'Feedback Test School' }).returning()
  schoolIds.push(s.id)
  return s.id
}

async function seed(schoolId: string | null, o: Partial<typeof feedback.$inferInsert> = {}) {
  const [created] = await db.insert(feedback).values({
    senderName: 'Someone',
    rating: 4,
    content: 'seeded feedback',
    type: 'Teacher -> Management',
    status: 'Submitted',
    date: today(),
    schoolId,
    ...o,
  }).returning()
  if (schoolId === null) nullSchoolRowIds.push(created.id)
  return created
}

afterEach(async () => {
  if (schoolIds.length > 0) {
    await db.delete(feedback).where(inArray(feedback.schoolId, schoolIds))
    await db.delete(schools).where(inArray(schools.id, schoolIds))
    schoolIds.length = 0
  }
  if (nullSchoolRowIds.length > 0) {
    await db.delete(feedback).where(inArray(feedback.id, nullSchoolRowIds))
    nullSchoolRowIds.length = 0
  }
  jest.clearAllMocks()
})

describe('POST /api/feedback', () => {
  it('rejects bulk upload from a teacher and inserts nothing', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const res = await POST(postBody({ action: 'bulk', items: [{ content: 'fake', type: 'Management -> Teacher' }] }))
    expect(res.status).toBe(403)

    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const list = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(list.totalCount).toBe(0)
  })

  it('allows bulk upload from management and never stores anonymity', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const res = await POST(postBody({
      action: 'bulk',
      items: [{ content: 'from sheet', type: 'Teacher -> Management', senderName: 'Carol', isAnonymous: true }],
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.count).toBe(1)
    expect(body.created[0].isAnonymous).toBe(false)
    expect(body.created[0].senderName).toBe('Carol')
  })

  it('defaults a bulk row with no type to a staff flow so it is visible', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const res = await POST(postBody({ action: 'bulk', items: [{ content: 'no type given' }] }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.created[0].type).toBe('Teacher -> Management')
    expect(body.hiddenCount).toBe(0)
  })

  it('reports how many bulk rows are stored but hidden from the UI', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })
    const res = await POST(postBody({
      action: 'bulk',
      items: [
        { content: 'staff row', type: 'Teacher -> Management' },
        { content: 'student row', type: 'Student -> Teacher' },
        { content: 'parent row', type: 'Parent -> School' },
      ],
    }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.count).toBe(3)
    expect(body.hiddenCount).toBe(2)
  })

  it('stores the real sender name even when isAnonymous is sent', async () => {
    const schoolId = await makeSchool()
    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const res = await POST(postBody({ content: 'Need a projector', rating: 4, isAnonymous: true }))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.senderName).toBe('Alice Teacher')
    expect(body.isAnonymous).toBe(false)
    expect(body.type).toBe('Teacher -> Management')
  })
})

describe('GET /api/feedback as teacher', () => {
  it('returns only the caller\'s own sent items and the feedback addressed to them', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { senderName: 'Alice Teacher', content: 'alice up' })
    await seed(schoolId, { senderName: 'Bob Teacher', content: 'bob up' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'All Faculty', content: 'broadcast' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'Bob Teacher', subject: 'bob@school.test', content: 'for bob' })

    asUser({ role: 'teacher', schoolId, name: 'Alice Teacher', email: 'alice@school.test' })
    const body = await (await GET(req('http://localhost/api/feedback'))).json()

    expect(body.sent.map((f: any) => f.content)).toEqual(['alice up'])
    expect(body.received.map((f: any) => f.content)).toEqual(['broadcast'])
  })
})

describe('GET /api/feedback as teacher whose faculty-directory name differs from their account name', () => {
  async function makeFaculty(schoolId: string, o: Partial<typeof faculty.$inferInsert>) {
    const [f] = await db.insert(faculty).values({
      name: 'Rohit Sir', subject: 'General', specialization: '', schoolId, ...o,
    }).returning()
    return f
  }

  it('delivers feedback addressed to the teacher\'s faculty record, found by email', async () => {
    const schoolId = await makeSchool()
    await makeFaculty(schoolId, { name: 'Rohit Sir', email: 'rohit@school.test' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'Rohit Sir', subject: 'General', content: 'for rohit' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'Someone Else', subject: 'General', content: 'for someone else' })

    asUser({ id: '00000000-0000-4000-8000-000000000001', role: 'teacher', schoolId, name: 'Rohit Gupta', email: 'rohit@school.test' })
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.received.map((f: any) => f.content)).toEqual(['for rohit'])
  })

  it('does not use a same-email faculty record from another school', async () => {
    const schoolId = await makeSchool()
    const otherSchoolId = await makeSchool()
    await makeFaculty(otherSchoolId, { name: 'Rohit Sir', email: 'rohit@school.test' })
    await seed(schoolId, { type: 'Management -> Teacher', batch: 'Rohit Sir', subject: 'General', content: 'not for this teacher' })

    asUser({ id: '00000000-0000-4000-8000-000000000001', role: 'teacher', schoolId, name: 'Rohit Gupta', email: 'rohit@school.test' })
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.received).toEqual([])
  })
})

describe('GET /api/feedback as management', () => {
  const admin = (schoolId: string) => ({ role: 'management', schoolId, name: 'Admin', email: 'admin@school.test' })

  it('counts only this month for the monthly KPI', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { date: today() })
    await seed(schoolId, { date: '2020-01-01' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.totalCount).toBe(2)
    expect(body.thisMonthCount).toBe(1)
  })

  it('keeps Reviewed in the pending view only', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Reviewed' })
    asUser(admin(schoolId))
    const pending = await (await GET(req('http://localhost/api/feedback?view=pending'))).json()
    const actioned = await (await GET(req('http://localhost/api/feedback?view=actioned'))).json()
    expect(pending.feedbackList).toHaveLength(1)
    expect(actioned.feedbackList).toHaveLength(0)
    expect(pending.pendingCount).toBe(1)
    expect(pending.actionedCount).toBe(0)
  })

  it('lists Actioned and Dismissed in the actioned view', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Actioned' })
    await seed(schoolId, { status: 'Dismissed' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback?view=actioned'))).json()
    expect(body.feedbackList).toHaveLength(2)
    expect(body.actionedCount).toBe(2)
    expect(body.pendingCount).toBe(0)
  })

  it('treats an unknown view as pending', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { status: 'Submitted' })
    await seed(schoolId, { status: 'Actioned' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback?view=bogus'))).json()
    expect(body.feedbackList.map((f: any) => f.status)).toEqual(['Submitted'])
  })

  it('hides student and parent feedback from lists and KPIs', async () => {
    const schoolId = await makeSchool()
    await seed(schoolId, { type: 'Student -> Teacher' })
    await seed(schoolId, { type: 'Parent -> School' })
    await seed(schoolId, { type: 'Teacher -> Management' })
    asUser(admin(schoolId))

    const all = await (await GET(req('http://localhost/api/feedback?type=All'))).json()
    expect(all.totalCount).toBe(1)
    expect(all.feedbackList).toHaveLength(1)

    const student = await (await GET(req(`http://localhost/api/feedback?type=${encodeURIComponent('Student -> Teacher')}`))).json()
    expect(student.feedbackList).toEqual([])
  })

  it('does not return other schools\' rows or rows with no school', async () => {
    const schoolId = await makeSchool()
    const otherSchoolId = await makeSchool()
    await seed(schoolId, { content: 'mine' })
    await seed(otherSchoolId, { content: 'other school' })
    await seed(null, { content: 'no school' })
    asUser(admin(schoolId))
    const body = await (await GET(req('http://localhost/api/feedback'))).json()
    expect(body.feedbackList.map((f: any) => f.content)).toEqual(['mine'])
    expect(body.totalCount).toBe(1)
  })
})
