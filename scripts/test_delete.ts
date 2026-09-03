import { db } from '@/lib/db'
import { chapters, masterCurriculum } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { deleteChapter, createChapter } from '@/lib/db/queries/curriculum'

async function run() {
  const schoolId = '8faaf249-90a9-4105-9c37-62be71d75aee'
  
  // Create a chapter
  const chap = await createChapter({
    schoolId,
    name: 'Test Chapter',
    code: 'TEST-1',
    board: 'CBSE',
    classLevel: 'Class 12',
    subjectId: null as any,
    programId: null as any,
  })
  
  console.log('Created chapter:', chap.id)
  
  let mcs = await db.select().from(masterCurriculum).where(eq(masterCurriculum.chapterCode, 'TEST-1'))
  console.log('Master Curriculum after create:', mcs.length)
  
  await deleteChapter(chap.id, schoolId)
  console.log('Deleted chapter')
  
  mcs = await db.select().from(masterCurriculum).where(eq(masterCurriculum.chapterCode, 'TEST-1'))
  console.log('Master Curriculum after delete:', mcs.length)
  
  process.exit(0)
}
run().catch(console.error)
