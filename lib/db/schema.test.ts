import { db } from './index'
import { users, emailVerifications, schools } from './schema'

describe('schema', () => {
  it('can query all three tables without error', async () => {
    await expect(db.select().from(users)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(emailVerifications)).resolves.toEqual(expect.any(Array))
    await expect(db.select().from(schools)).resolves.toEqual(expect.any(Array))
  })
})
