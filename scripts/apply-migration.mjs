import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

const migration = readFileSync('./lib/db/migrations/0022_programs_batches_structure.sql', 'utf8') // latest migration

// Split on Drizzle statement-breakpoint markers or semicolons
const statements = migration
  .split(/--> statement-breakpoint/)
  .map(s => s.trim())
  .filter(s => s.length > 0)

console.log(`Applying ${statements.length} statements...`)

for (const stmt of statements) {
  console.log('Running:', stmt.slice(0, 60) + '...')
  await sql.query(stmt)
}

console.log('Done.')
