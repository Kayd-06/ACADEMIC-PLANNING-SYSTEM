import { db } from '../index'
import { chapters, concepts, subjects } from '../schema'
import {
  listChaptersBySubject,
  createChapter,
  updateChapter,
  deleteChapter,
  listConceptsByChapter,
  createConcept,
  updateConcept,
  deleteConcept,
} from './curriculum'

describe('curriculum queries', () => {
  afterEach(async () => {
    await db.delete(concepts)
    await db.delete(chapters)
    await db.delete(subjects)
  })

  it('createChapter applies code/board defaults', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Physics' }).returning()
    const chapter = await createChapter({ subjectId: subject.id, name: 'Kinematics' })
    expect(chapter.code).toBe('')
    expect(chapter.board).toBeNull()
  })

  it('createChapter persists explicit code/board', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Physics' }).returning()
    const chapter = await createChapter({ subjectId: subject.id, name: 'Optics', code: 'PHY-05', board: 'CBSE' })
    expect(chapter.code).toBe('PHY-05')
    expect(chapter.board).toBe('CBSE')
  })

  it('listChaptersBySubject returns only subject\'s chapters, ordered by orderIndex then name', async () => {
    const [subject1] = await db.insert(subjects).values({ name: 'Physics' }).returning()
    const [subject2] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    await db.insert(chapters).values({ subjectId: subject1.id, name: 'Newton\'s Laws', orderIndex: 2 })
    await db.insert(chapters).values({ subjectId: subject1.id, name: 'Kinematics', orderIndex: 1 })
    await db.insert(chapters).values({ subjectId: subject2.id, name: 'Periodic Table', orderIndex: 1 })

    const result = await listChaptersBySubject(subject1.id)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Kinematics')
    expect(result[1].name).toBe('Newton\'s Laws')
  })

  it('updateChapter modifies row, leaves code/board unspecified untouched', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Biology' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Genetics' }).returning()

    const updated = await updateChapter(chapter.id, { name: 'Heredity' })

    expect(updated).not.toBeNull()
    expect(updated?.name).toBe('Heredity')
    expect(updated?.code).toBe('')
    expect(updated?.board).toBeNull()
  })

  it('deleteChapter removes row', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Biology' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Genetics' }).returning()

    await deleteChapter(chapter.id)

    const remaining = await listChaptersBySubject(subject.id)
    expect(remaining).toEqual([])
  })

  it('createConcept links chapter applies code default', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Chemical Bonding' }).returning()

    const concept = await createConcept({ chapterId: chapter.id, name: 'Ionic Bonding' })
    expect(concept.chapterId).toBe(chapter.id)
    expect(concept.code).toBe('')
  })

  it('listConceptsByChapter returns only chapter\'s concepts, ordered by orderIndex then name', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Chemical Bonding' }).returning()
    const [otherChapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Thermochemistry' }).returning()
    await db.insert(concepts).values({ chapterId: chapter.id, name: 'Covalent Bonding', orderIndex: 2 })
    await db.insert(concepts).values({ chapterId: chapter.id, name: 'Ionic Bonding', orderIndex: 1 })
    await db.insert(concepts).values({ chapterId: otherChapter.id, name: 'Enthalpy', orderIndex: 1 })

    const result = await listConceptsByChapter(chapter.id)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Ionic Bonding')
    expect(result[1].name).toBe('Covalent Bonding')
  })

  it('updateConcept modifies row', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Bonding' }).returning()
    const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Covalent Bond' }).returning()

    const updated = await updateConcept(concept.id, { name: 'Covalent Bonding' })

    expect(updated).not.toBeNull()
    expect(updated?.name).toBe('Covalent Bonding')
  })

  it('deleteConcept removes row', async () => {
    const [subject] = await db.insert(subjects).values({ name: 'Chemistry' }).returning()
    const [chapter] = await db.insert(chapters).values({ subjectId: subject.id, name: 'Bonding' }).returning()
    const [concept] = await db.insert(concepts).values({ chapterId: chapter.id, name: 'Ionic Bond' }).returning()

    await deleteConcept(concept.id)

    const remaining = await listConceptsByChapter(chapter.id)
    expect(remaining).toEqual([])
  })
})
