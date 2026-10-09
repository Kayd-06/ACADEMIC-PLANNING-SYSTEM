import { foreignRef, malformedRef, requestedRefs } from './refs'

const T = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'

describe('batch foreign id checks', () => {
  it('ignores cleared or absent links', () => {
    expect(requestedRefs({ teacherId: null, programId: '' })).toEqual({})
    expect(requestedRefs({})).toEqual({})
  })

  it('rejects non-UUID ids before touching the DB', () => {
    expect(malformedRef(requestedRefs({ teacherId: 'abc' }))).toBe('Coordinator id is not valid.')
    expect(malformedRef(requestedRefs({ programId: '1; drop table' }))).toBe('Program id is not valid.')
    expect(malformedRef(requestedRefs({ teacherId: T, programId: P }))).toBeNull()
  })

  it('rejects ids from another school', () => {
    const inSchool = { teacherId: new Set([T]), programId: new Set([P]) }
    expect(foreignRef({ teacherId: T, programId: P }, inSchool)).toBeNull()
    expect(foreignRef({ teacherId: OTHER }, inSchool)).toBe('Coordinator was not found in your school.')
    expect(foreignRef({ programId: OTHER }, inSchool)).toBe('Program was not found in your school.')
    expect(foreignRef({ programId: P }, {})).toBe('Program was not found in your school.')
  })
})
