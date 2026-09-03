import { db } from '@/lib/db'
import { chapters } from '@/lib/db/schema'
async function run() {
  const chaps = await db.select().from(chapters)
  console.log('Total chapters:', chaps.length)
  process.exit(0)
}
run().catch(console.error)
