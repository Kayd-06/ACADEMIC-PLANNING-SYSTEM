import { db } from '@/lib/db'
import { chapters, concepts, masterCurriculum } from '@/lib/db/schema'

async function run() {
  await db.delete(masterCurriculum)
  await db.delete(concepts)
  await db.delete(chapters)
  
  console.log('All curriculum data wiped successfully!')
  process.exit(0)
}
run().catch(console.error)
