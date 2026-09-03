import { db } from '@/lib/db'
import { chapters, concepts, masterCurriculum, subjects, programs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function run() {
  await db.delete(masterCurriculum) // Clear all master curriculum rows first
  
  const allChaps = await db.select().from(chapters)
  const allConcepts = await db.select().from(concepts)
  
  for (const chap of allChaps) {
    let subjectName = '', programName = ''
    if (chap.subjectId) {
      const [s] = await db.select().from(subjects).where(eq(subjects.id, chap.subjectId))
      if (s) subjectName = s.name
    }
    if (chap.programId) {
      const [p] = await db.select().from(programs).where(eq(programs.id, chap.programId))
      if (p) programName = p.name
    }
    
    const chConcepts = allConcepts.filter(c => c.chapterId === chap.id)
    if (chConcepts.length === 0) {
      await db.insert(masterCurriculum).values({
        schoolId: chap.schoolId || '00000000-0000-0000-0000-000000000000',
        board: chap.board || '',
        program: programName,
        classLevel: chap.classLevel || '',
        subject: subjectName,
        chapterName: chap.name,
        chapterCode: chap.code,
        chapterOrderIndex: chap.orderIndex || 0,
        expectedHours: chap.expectedHours || 0,
        conceptName: '',
        conceptCode: '',
        conceptOrderIndex: 0
      })
    } else {
      for (const c of chConcepts) {
        await db.insert(masterCurriculum).values({
          schoolId: c.schoolId || chap.schoolId || '00000000-0000-0000-0000-000000000000',
          board: chap.board || '',
          program: programName,
          classLevel: chap.classLevel || '',
          subject: subjectName,
          chapterName: chap.name,
          chapterCode: chap.code,
          chapterOrderIndex: chap.orderIndex || 0,
          expectedHours: chap.expectedHours || 0,
          conceptName: c.name,
          conceptCode: c.code,
          conceptOrderIndex: c.orderIndex || 0
        })
      }
    }
  }
  
  console.log('Re-synced master_curriculum based on chapters & concepts tables!')
  process.exit(0)
}
run().catch(console.error)
