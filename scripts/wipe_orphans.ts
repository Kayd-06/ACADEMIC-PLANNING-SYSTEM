import { db } from '@/lib/db'
import { chapters, masterCurriculum } from '@/lib/db/schema'

async function run() {
  const chaps = await db.select().from(chapters)
  const mcRows = await db.select().from(masterCurriculum)
  
  const chapterCodes = new Set(chaps.map(c => c.code))
  
  for (const row of mcRows) {
    if (!chapterCodes.has(row.chapterCode)) {
      console.log('Deleting orphan master curriculum row for chapter code:', row.chapterCode)
      await db.delete(masterCurriculum).where(require('drizzle-orm').eq(masterCurriculum.id, row.id))
    }
  }
  console.log('Done.')
  process.exit(0)
}
run().catch(console.error)
