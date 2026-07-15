// Pure logic test — no database connection, no DATABASE_URL needed, no risk
// of ever touching the real (shared, production-serving) Neon instance.
import { shouldBlockDelete } from './dbGuard'

describe('shouldBlockDelete', () => {
  const prevAllow = process.env.ALLOW_UNSCOPED_DELETES

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.ALLOW_UNSCOPED_DELETES
    else process.env.ALLOW_UNSCOPED_DELETES = prevAllow
  })

  it('blocks an unscoped delete on a guarded table (real Drizzle output, no WHERE)', () => {
    expect(shouldBlockDelete('delete from "users"', [])).toBe(true)
  })

  it('allows a properly scoped delete with a defined WHERE param (real Drizzle output)', () => {
    expect(shouldBlockDelete('delete from "users" where "users"."id" = $1', ['abc-123'])).toBe(false)
  })

  it('blocks a delete whose WHERE param is undefined (eq(col, undefinedVar) bug pattern)', () => {
    expect(shouldBlockDelete('delete from "users" where "users"."id" = $1', [undefined])).toBe(true)
  })

  it('blocks unscoped deletes on every guarded table', () => {
    const tables = ['users', 'schools', 'students', 'tests', 'questions', 'student_reports', 'student_report_entries', 'test_grades']
    for (const t of tables) {
      expect(shouldBlockDelete(`delete from "${t}"`, [])).toBe(true)
    }
  })

  it('does not block deletes on tables outside the guarded list', () => {
    expect(shouldBlockDelete('delete from "notifications"', [])).toBe(false)
  })

  it('does not block non-delete statements', () => {
    expect(shouldBlockDelete('select * from "users"', [])).toBe(false)
    expect(shouldBlockDelete('insert into "users" ("name") values ($1)', ['x'])).toBe(false)
  })

  it('bypasses the guard entirely when ALLOW_UNSCOPED_DELETES=true', () => {
    process.env.ALLOW_UNSCOPED_DELETES = 'true'
    expect(shouldBlockDelete('delete from "users"', [])).toBe(false)
  })
})
