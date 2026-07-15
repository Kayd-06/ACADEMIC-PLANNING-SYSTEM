// Pure decision logic for the DB Guard, split out from index.ts so it can be
// unit tested without a real database connection — this project has no
// separate test database, so the guard itself must never be "verified" by
// actually running a DELETE against the shared one.

const GUARDED_TABLES = 'users|schools|students|tests|questions|student_reports|student_report_entries|test_grades'
const UNSCOPED_DELETE_PATTERN = new RegExp(`^delete from "(${GUARDED_TABLES})"`, 'i')

export function shouldBlockDelete(queryStr: string, params?: any[]): boolean {
  if (process.env.ALLOW_UNSCOPED_DELETES === 'true') return false
  if (typeof queryStr !== 'string' || !UNSCOPED_DELETE_PATTERN.test(queryStr.trim())) return false

  const hasWhere = /where/i.test(queryStr)
  const firstParamUndefined = !!params && params.length > 0 && params[0] === undefined
  return !hasWhere || firstParamUndefined
}
