import { db } from '@/lib/db'
import { masterCurriculum } from '@/lib/db/schema'

async function run() {
  const rows = await db.select().from(masterCurriculum)
  console.log('Total rows in master_curriculum:', rows.length)
  if (rows.length > 0) {
    console.log('Sample rows:')
    console.log(rows.slice(0, 3).map(r => ({
      board: r.board,
      classLevel: r.classLevel,
      program: r.program,
      subject: r.subject,
      chapterName: r.chapterName,
      chapterCode: r.chapterCode
    })))
  }
  process.exit(0)
}
run().catch(console.error)
