// Removes only fixtures conclusively identified as test data.
// Preview is the default; pass --apply to perform the deletes.
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')

const sql = neon(process.env.DATABASE_URL)
const apply = process.argv.includes('--apply')
const fakeEmailPattern = '%@example.com'

const checks = [
  {
    label: 'student reports owned by test accounts',
    params: [fakeEmailPattern],
    count: `SELECT count(*)::int AS n FROM student_reports
      WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE $1)`,
    remove: `DELETE FROM student_reports
      WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE $1) RETURNING id`,
  },
  {
    label: 'unscoped test records',
    params: [],
    count: `SELECT count(*)::int AS n FROM tests WHERE school_id IS NULL`,
    remove: `DELETE FROM tests WHERE school_id IS NULL RETURNING id`,
  },
  {
    label: 'unscoped question fixtures',
    params: [],
    count: `SELECT count(*)::int AS n FROM questions WHERE school_id IS NULL`,
    remove: `DELETE FROM questions WHERE school_id IS NULL RETURNING id`,
  },
  {
    label: 'unscoped student fixtures',
    params: [],
    count: `SELECT count(*)::int AS n FROM students WHERE school_id IS NULL`,
    remove: `DELETE FROM students WHERE school_id IS NULL RETURNING id`,
  },
  {
    label: 'reserved example.com test accounts',
    params: [fakeEmailPattern],
    count: `SELECT count(*)::int AS n FROM users WHERE email LIKE $1`,
    remove: `DELETE FROM users WHERE email LIKE $1 RETURNING id`,
  },
]

console.log(apply ? 'Applying confirmed test-fixture cleanup:' : 'Confirmed test-fixture cleanup preview:')
for (const check of checks) {
  if (apply) {
    const deleted = await sql.query(check.remove, check.params)
    console.log(`- ${check.label}: ${deleted.length} deleted`)
  } else {
    const [row] = await sql.query(check.count, check.params)
    console.log(`- ${check.label}: ${row.n} found`)
  }
}

if (!apply) console.log('No records changed. Re-run with --apply to delete these fixtures.')
