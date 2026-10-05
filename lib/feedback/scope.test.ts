import type { Feedback } from '@/lib/db/schema'
import { splitTeacherFeedback } from './scope'

function row(o: Partial<Feedback> = {}): Feedback {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    senderName: 'Sender',
    isAnonymous: false,
    rating: 5,
    content: 'content',
    type: 'Management -> Teacher',
    status: 'Submitted',
    subject: '',
    batch: '',
    category: '',
    date: '2026-10-10',
    schoolId: null,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    updatedAt: new Date('2026-10-10T00:00:00Z'),
    ...o,
  }
}

const alice = { name: 'Alice Teacher', email: 'alice@school.test' }

describe('splitTeacherFeedback — received', () => {
  it('includes broadcasts (empty batch or "All Faculty") for every teacher', () => {
    const items = [row({ batch: '' }), row({ batch: 'All Faculty' })]
    expect(splitTeacherFeedback(items, alice).received).toHaveLength(2)
    expect(splitTeacherFeedback(items, { name: 'Bob', email: 'bob@school.test' }).received).toHaveLength(2)
  })

  it('includes feedback addressed to the teacher by name or by email', () => {
    const byName = row({ batch: 'Alice Teacher', subject: 'Physics' })
    const byEmail = row({ batch: 'Someone Else', subject: 'ALICE@school.test' })
    const result = splitTeacherFeedback([byName, byEmail], alice).received
    expect(result).toEqual([byName, byEmail])
  })

  it('does not match a teacher whose name is only part of the addressee\'s name', () => {
    const toRajesh = row({ batch: 'Rajesh Kumar', subject: 'rajesh@school.test' })
    const toRaviSingh = row({ batch: 'Ravi Kumar Singh', subject: '' })
    expect(splitTeacherFeedback([toRajesh, toRaviSingh], { name: 'Raj', email: 'raj@school.test' }).received).toEqual([])
    expect(splitTeacherFeedback([toRaviSingh], { name: 'Ravi Kumar', email: 'ravi@school.test' }).received).toEqual([])
  })

  it('matches the addressee name ignoring case and surrounding spaces', () => {
    const item = row({ batch: '  alice teacher ', subject: '' })
    expect(splitTeacherFeedback([item], alice).received).toEqual([item])
  })

  it('excludes feedback addressed to another teacher', () => {
    const toBob = row({ batch: 'Bob Teacher', subject: 'bob@school.test' })
    expect(splitTeacherFeedback([toBob], alice).received).toEqual([])
  })

  it('ignores Teacher -> Management rows', () => {
    const up = row({ type: 'Teacher -> Management', batch: '' })
    expect(splitTeacherFeedback([up], alice).received).toEqual([])
  })

  it('with an empty name and email, receives broadcasts only', () => {
    const broadcast = row({ batch: 'All Faculty' })
    const personal = row({ batch: 'Alice Teacher', subject: '' })
    const noSubject = row({ batch: 'Bob Teacher', subject: '' })
    const result = splitTeacherFeedback([broadcast, personal, noSubject], { name: '', email: '' })
    expect(result.received).toEqual([broadcast])
  })
})

describe('splitTeacherFeedback — sent', () => {
  it('returns only the caller\'s own Teacher -> Management rows (case-insensitive)', () => {
    const mine = row({ type: 'Teacher -> Management', senderName: 'alice teacher' })
    const theirs = row({ type: 'Teacher -> Management', senderName: 'Bob Teacher' })
    const wrongType = row({ type: 'Management -> Teacher', senderName: 'Alice Teacher' })
    expect(splitTeacherFeedback([mine, theirs, wrongType], alice).sent).toEqual([mine])
  })

  it('returns nothing when the teacher name is empty', () => {
    const blank = row({ type: 'Teacher -> Management', senderName: '' })
    expect(splitTeacherFeedback([blank], { name: '', email: 'a@b.test' }).sent).toEqual([])
  })
})
