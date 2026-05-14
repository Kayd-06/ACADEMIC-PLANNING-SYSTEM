import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

export default async function RootPage() {
  const session = await auth()
  
  if (session) {
    // Map roles to their respective dashboard paths
    const role = session.user.role?.toLowerCase()
    if (role === 'management' || role === 'academic administration' || role === 'admin') {
      redirect('/management')
    } else if (role === 'teacher' || role === 'faculty') {
      redirect('/teacher')
    } else {
      // Fallback redirect if role is unknown
      redirect('/management')
    }
  }

  return <LandingPage />
}
