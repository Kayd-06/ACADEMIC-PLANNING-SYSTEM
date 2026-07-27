import { eq } from 'drizzle-orm'
import { db } from '../index'
import { students, schools, users } from '../schema'
import {
  getEligibleStudents,
  getExcludedNewAdmissionCount,
  getActiveClass12Count,
  getManagementUserIds,
} from './classPromotion'

describe('classPromotion queries', () => {
  const schoolIds: string[] = []

  afterEach(async () => {
    for (const schoolId of schoolIds) {
      await db.delete(students).where(eq(students.schoolId, schoolId))
      await db.delete(users).where(eq(users.schoolId, schoolId))
      await db.delete(schools).where(eq(schools.id, schoolId))
    }
    schoolIds.length = 0
  })

  it('getEligibleStudents returns only active 9/10/11 students admitted before the boundary', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'Old Enough', class: '9', admissionDate: '2025-01-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Too New', class: '9', admissionDate: '2026-06-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Class 12', class: '12', admissionDate: '2020-01-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Inactive', class: '9', admissionDate: '2020-01-01', schoolId: school.id, isActive: false })

    const result = await getEligibleStudents(school.id, '2026-04-01')
    expect(result.map((s) => s.class)).toEqual(['9'])
  })

  it('getExcludedNewAdmissionCount counts active 9/10/11 students admitted on/after the boundary', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'New Admission', class: '10', admissionDate: '2026-04-01', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Old Admission', class: '10', admissionDate: '2020-01-01', schoolId: school.id, isActive: true })

    const count = await getExcludedNewAdmissionCount(school.id, '2026-04-01')
    expect(count).toBe(1)
  })

  it('getActiveClass12Count counts only active Class 12 students', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    await db.insert(students).values({ name: 'Active 12', class: '12', schoolId: school.id, isActive: true })
    await db.insert(students).values({ name: 'Inactive 12', class: '12', schoolId: school.id, isActive: false })
    await db.insert(students).values({ name: 'Active 11', class: '11', schoolId: school.id, isActive: true })

    const count = await getActiveClass12Count(school.id)
    expect(count).toBe(1)
  })

  it('getManagementUserIds returns only management-role users of the given school', async () => {
    const [school] = await db.insert(schools).values({}).returning()
    schoolIds.push(school.id)
    const [manager] = await db.insert(users).values({
      name: 'Manager', email: `mgr-${Date.now()}@test.com`, password: 'x', role: 'management', schoolId: school.id,
    }).returning()
    await db.insert(users).values({
      name: 'Teacher', email: `tch-${Date.now()}@test.com`, password: 'x', role: 'teacher', schoolId: school.id,
    })

    const ids = await getManagementUserIds(school.id)
    expect(ids).toEqual([manager.id])
  })
})
