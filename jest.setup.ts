const { config } = require('dotenv')
// override: true — Next's own env loader (via next/jest) skips .env.local
// under NODE_ENV=test and loads plain .env first, which already sets
// DATABASE_URL by the time this runs. dotenv doesn't overwrite existing
// env vars by default, so without override the stale .env value would win.
config({ path: '.env.local', override: true })

// Never let database-backed tests write to the application's live database.
// Unit tests continue to run normally; integration tests need an explicitly
// configured isolated database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
} else {
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test_database_required'
}
require('@testing-library/jest-dom')
