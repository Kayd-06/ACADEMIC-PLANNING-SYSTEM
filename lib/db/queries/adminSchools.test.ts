import { eq } from 'drizzle-orm'
import { db } from '../index'
import { schools, users, adminSchools } from '../schema'
import { getAdminSchools } from './adminSchools'

describe('getAdminSchools', () => {
  it('includes academicYearStartMonth for each school', async () => {
    const [school] = await db.insert(schools).values({ academicYearStartMonth: 6 }).returning()
    const [user] = await db.insert(users).values({
      name: 'Owner', email: `owner-${Date.now()}@test.com`, password: 'x', role: 'management',
    }).returning()
    await db.insert(adminSchools).values({ userId: user.id, schoolId: school.id, role: 'owner' })

    try {
      const result = await getAdminSchools(user.id)
      expect(result).toHaveLength(1)
      expect(result[0].academicYearStartMonth).toBe(6)
    } finally {
      await db.delete(adminSchools).where(eq(adminSchools.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
      await db.delete(schools).where(eq(schools.id, school.id))
    }
  })
})
