import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

const migration = readFileSync('./lib/db/migrations/0005_drop_teacher_fk.sql', 'utf8')

console.log('Applying migration...')
await sql.query(migration)
console.log('Done.')
