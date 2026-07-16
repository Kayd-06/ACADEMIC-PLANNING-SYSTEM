import { db } from '../index'
import { users } from '../schema'
import { eq } from 'drizzle-orm'
import { createUser, findUserByEmail, findUserById, updateUserStatus, updateUserPassword } from './users'

describe('user queries', () => {
  const testEmail = `test-user-queries-${Date.now()}@example.com`
  let createdId: string | undefined

  afterAll(async () => {
    if (createdId) {
      await db.delete(users).where(eq(users.id, createdId))
      createdId = undefined
    }
  })

  it('createUser inserts a row and returns it', async () => {
    const user = await createUser({
      name: 'Test Teacher',
      email: testEmail,
      password: 'hashed-password',
      role: 'teacher',
      status: 'pending_verification',
    })
    createdId = user.id
    expect(user.email).toBe(testEmail)
    expect(user.status).toBe('pending_verification')
  })

  it('findUserByEmail returns the created user', async () => {
    const user = await findUserByEmail(testEmail)
    expect(user?.id).toBe(createdId)
  })

  it('findUserByEmail returns null for an unknown email', async () => {
    const user = await findUserByEmail('nobody-here@example.com')
    expect(user).toBeNull()
  })

  it('findUserById returns the created user', async () => {
    const user = await findUserById(createdId!)
    expect(user?.email).toBe(testEmail)
  })

  it('updateUserStatus sets the new status', async () => {
    const updated = await updateUserStatus(createdId!, 'active')
    expect(updated?.status).toBe('active')
  })

  it('updateUserPassword sets a new password hash', async () => {
    const updated = await updateUserPassword(createdId!, 'new-hashed-value')
    expect(updated?.password).toBe('new-hashed-value')
  })
})
