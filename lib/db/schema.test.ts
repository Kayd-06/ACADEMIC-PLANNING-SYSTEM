import { db } from './index'
import { users, emailVerifications, schools, students, studentReports, studentReportEntries } from './schema'

describe('schema', () => {
  it('can query all tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(students)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReports)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(studentReportEntries)).resolves.toEqual(expect.any(Array))
  })
})
