import { config } from 'dotenv'
config({ path: '.env' })
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import path from 'path'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in .env.local')
    process.exit(1)
  }

  console.log('Connecting to Neon database over HTTP...')
  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql)

  console.log('Running migrations from lib/db/migrations...')
  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'lib/db/migrations')
    })
    console.log('Migrations applied successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main()
