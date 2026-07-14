import { config } from 'dotenv'
// override: true — Next's own env loader (via next/jest) skips .env.local
// under NODE_ENV=test and loads plain .env first, which already sets
// DATABASE_URL by the time this runs. dotenv doesn't overwrite existing
// env vars by default, so without override the stale .env value would win.
config({ path: '.env.local', override: true })
import '@testing-library/jest-dom'
