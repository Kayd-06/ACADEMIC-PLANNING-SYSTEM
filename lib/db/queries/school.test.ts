import { db } from '../index'
import { schools } from '../schema'
import { getOrCreateSchool, updateSchool } from './school'

describe('school queries', () => {
  afterAll(async () => {
    await db.delete(schools)
  })

  it('getOrCreateSchool creates a default row when none exists', async () => {
    const school = await getOrCreateSchool()
    expect(school.name).toBe('Academic Planning System')
    expect(school.board).toBe('CBSE Affiliated')
  })

  it('getOrCreateSchool returns the same row on a second call', async () => {
    const first = await getOrCreateSchool()
    const second = await getOrCreateSchool()
    expect(second.id).toBe(first.id)
  })

  it('updateSchool updates fields on the given school', async () => {
    const school = await getOrCreateSchool()
    const updated = await updateSchool(school.id, { board: 'ICSE Affiliated' })
    expect(updated.board).toBe('ICSE Affiliated')
  })
})
