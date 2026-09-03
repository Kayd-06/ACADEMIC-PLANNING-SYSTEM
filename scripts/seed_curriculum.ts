import { db } from '@/lib/db'
import { chapters, concepts, masterCurriculum, subjects, programs } from '@/lib/db/schema'

const REAL_DATA = [
  {
    board: 'CBSE',
    program: 'JEE S2',
    classLevel: 'Class 10',
    subject: 'Physics',
    chapterName: 'Light - Reflection and Refraction',
    chapterCode: 'PHY10-01',
    concepts: [
      { name: 'Reflection of Light', code: 'PHY10-01-01' },
      { name: 'Spherical Mirrors', code: 'PHY10-01-02' },
      { name: 'Refraction of Light', code: 'PHY10-01-03' }
    ]
  },
  {
    board: 'CBSE',
    program: 'JEE S2',
    classLevel: 'Class 10',
    subject: 'Physics',
    chapterName: 'Electricity',
    chapterCode: 'PHY10-02',
    concepts: [
      { name: 'Electric Current and Circuit', code: 'PHY10-02-01' },
      { name: 'Electric Potential and Potential Difference', code: 'PHY10-02-02' },
      { name: 'Ohm’s Law', code: 'PHY10-02-03' }
    ]
  },
  {
    board: 'CBSE',
    program: 'JEE S2',
    classLevel: 'Class 10',
    subject: 'Chemistry',
    chapterName: 'Chemical Reactions and Equations',
    chapterCode: 'CHE10-01',
    concepts: [
      { name: 'Chemical Equations', code: 'CHE10-01-01' },
      { name: 'Types of Chemical Reactions', code: 'CHE10-01-02' }
    ]
  }
]

async function run() {
  const schoolId = '8faaf249-90a9-4105-9c37-62be71d75aee' // From previous debug
  
  // Clean everything
  await db.delete(masterCurriculum)
  await db.delete(concepts)
  await db.delete(chapters)

  let cIndex = 1
  for (const item of REAL_DATA) {
    // 1. Get/Create Subject
    let subjectId
    const [sub] = await db.select().from(subjects).where(require('drizzle-orm').eq(subjects.name, item.subject))
    if (sub) {
      subjectId = sub.id
    } else {
      const [newSub] = await db.insert(subjects).values({ name: item.subject, code: item.subject.toUpperCase().slice(0, 3) }).returning()
      subjectId = newSub.id
    }

    // 2. Get/Create Program
    let programId
    const [prog] = await db.select().from(programs).where(require('drizzle-orm').eq(programs.name, item.program))
    if (prog) {
      programId = prog.id
    } else {
      const [newProg] = await db.insert(programs).values({ name: item.program, code: item.program.toUpperCase().replace(/\s/g, '') }).returning()
      programId = newProg.id
    }

    // 3. Create Chapter
    const [chap] = await db.insert(chapters).values({
      schoolId,
      subjectId,
      programId,
      board: item.board,
      classLevel: item.classLevel,
      name: item.chapterName,
      code: item.chapterCode,
      orderIndex: cIndex++
    }).returning()

    // 4. Create Concepts & Master Curriculum Rows
    let conceptIdx = 1
    for (const c of item.concepts) {
      await db.insert(concepts).values({
        schoolId,
        chapterId: chap.id,
        name: c.name,
        code: c.code,
        orderIndex: conceptIdx++
      })

      await db.insert(masterCurriculum).values({
        schoolId,
        board: item.board,
        program: item.program,
        classLevel: item.classLevel,
        subject: item.subject,
        chapterName: item.chapterName,
        chapterCode: item.chapterCode,
        chapterOrderIndex: chap.orderIndex || 0,
        expectedHours: 5,
        conceptName: c.name,
        conceptCode: c.code,
        conceptOrderIndex: conceptIdx - 1
      })
    }
  }

  console.log('Successfully seeded real curriculum data!')
  process.exit(0)
}
run().catch(console.error)
