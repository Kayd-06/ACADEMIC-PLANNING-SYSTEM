import { errorResponse, HttpError, isUniqueViolation, pickAllowed } from '@/lib/api/http'

describe('errorResponse', () => {
  it('passes HttpError messages and status through', async () => {
    const res = errorResponse(new HttpError(403, 'nope'), 'test')
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'nope' })
  })

  it('maps unique violations to 409 without leaking the constraint', async () => {
    const res = errorResponse({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }, 'test', {
      conflictMessage: 'Already exists',
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Already exists' })
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true)
  })

  it('hides raw messages of unexpected errors', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse(new Error('relation "students" does not exist'), 'test')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('students')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('pickAllowed', () => {
  it('keeps only allowed keys and never protected ones', () => {
    const out = pickAllowed({ name: 'a', schoolId: 'evil', id: 'x', extra: 1 }, ['name', 'schoolId', 'id'] as const)
    expect(out).toEqual({ name: 'a' })
  })
})
