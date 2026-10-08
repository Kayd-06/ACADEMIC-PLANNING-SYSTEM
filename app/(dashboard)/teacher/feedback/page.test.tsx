jest.mock('@/lib/auth', () => ({ auth: jest.fn() }))
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
jest.mock('@/components/dashboard/Sidebar', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/dashboard/TopHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/dashboard/teacher/TeacherFeedbackView', () => ({ __esModule: true, default: () => null }))

import { auth } from '@/lib/auth'
import FeedbackPage from './page'

function asUser(user: Record<string, unknown> | null) {
  ;(auth as jest.Mock).mockResolvedValue(user ? { user } : null)
}

describe('/teacher/feedback page', () => {
  afterEach(() => jest.clearAllMocks())

  it('sends management to their own feedback console instead of the teacher page', async () => {
    asUser({ role: 'management', name: 'Admin User' })
    await expect(FeedbackPage()).rejects.toThrow('NEXT_REDIRECT:/management/feedback')
  })

  it('sends signed-out visitors to login', async () => {
    asUser(null)
    await expect(FeedbackPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('renders for a teacher', async () => {
    asUser({ role: 'teacher', name: 'Alice Teacher' })
    await expect(FeedbackPage()).resolves.toBeTruthy()
  })
})
