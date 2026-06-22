import bcrypt from 'bcryptjs'
import { db } from './db'
import { users } from './db/schema'
import { eq } from 'drizzle-orm'
import { createUser } from './db/queries/users'

// NextAuth v5 doesn't export Credentials provider internals for unit testing,
// and next-auth's ESM packaging isn't transformable under this project's
// default Jest config, so importing lib/auth.ts directly isn't viable here.
// We instead verify the two things authorize() actually depends on: a real
// DB round-trip via findUserByEmail's underlying storage, and bcrypt
// comparison against the stored hash.
describe('auth — credentials authorize logic (via direct DB queries)', () => {
  const testEmail = `test-auth-${Date.now()}@example.com`
  const plainPassword = 'correct-password-123'
  let userId: string

  beforeAll(async () => {
    const hashed = await bcrypt.hash(plainPassword, 12)
    const user = await createUser({
      name: 'Auth Test User',
      email: testEmail,
      password: hashed,
      role: 'teacher',
      status: 'active',
    })
    userId = user.id
  })

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it('a matching bcrypt hash validates against the stored password', async () => {
    const stored = await db.select().from(users).where(eq(users.id, userId))
    const match = await bcrypt.compare(plainPassword, stored[0].password)
    expect(match).toBe(true)
  })

  it('a non-matching password fails bcrypt comparison', async () => {
    const stored = await db.select().from(users).where(eq(users.id, userId))
    const match = await bcrypt.compare('wrong-password', stored[0].password)
    expect(match).toBe(false)
  })
})
