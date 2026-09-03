import { db } from '@/lib/db'
import { chapters, masterCurriculum } from '@/lib/db/schema'

async function check() {
  const chaps = await db.select().from(chapters)
  const mcs = await db.select().from(masterCurriculum)
  console.log('Chapters:', chaps.map(c => ({ id: c.id, code: c.code, schoolId: c.schoolId })))
  console.log('Master Curriculum:', mcs.map(m => ({ id: m.id, code: m.chapterCode, schoolId: m.schoolId })))
  process.exit(0)
}
check().catch(console.error)
