import { db } from './lib/db'
import { studentReports } from './lib/db/schema'

async function run() {
  const reports = await db.select().from(studentReports)
  console.log('REPORTS:', reports)
  process.exit(0)
}

run().catch(console.error)
