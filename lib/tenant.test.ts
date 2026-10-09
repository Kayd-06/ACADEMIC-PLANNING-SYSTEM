import { requireSchool, sessionSchoolId, schoolScope, NO_SCHOOL_MESSAGE } from '@/lib/tenant'
import { HttpError } from '@/lib/api/http'
import { students } from '@/lib/db/schema'
import { PgDialect } from 'drizzle-orm/pg-core'

const SCHOOL = '11111111-2222-3333-4444-555555555555'

describe('tenant helpers', () => {
  it('reads a valid school id from the session', () => {
    expect(sessionSchoolId({ user: { schoolId: SCHOOL } })).toBe(SCHOOL)
    expect(requireSchool({ user: { schoolId: SCHOOL } })).toBe(SCHOOL)
  })

  it.each([null, undefined, '', 'null', 'undefined', 'not-a-uuid', 42])('rejects schoolId=%p', (schoolId) => {
    const session = { user: { schoolId } }
    expect(sessionSchoolId(session)).toBeNull()
    expect(() => requireSchool(session)).toThrow(HttpError)
    try {
      requireSchool(session)
    } catch (e) {
      expect((e as HttpError).status).toBe(403)
      expect((e as HttpError).message).toBe(NO_SCHOOL_MESSAGE)
    }
  })

  it('schoolScope matches nothing when the school is missing', () => {
    const dialect = new PgDialect()
    expect(dialect.sqlToQuery(schoolScope(students.schoolId, null)).sql).toBe('false')
    const scoped = dialect.sqlToQuery(schoolScope(students.schoolId, SCHOOL))
    expect(scoped.sql).toContain('"school_id" = $1')
    expect(scoped.params).toEqual([SCHOOL])
  })
})
