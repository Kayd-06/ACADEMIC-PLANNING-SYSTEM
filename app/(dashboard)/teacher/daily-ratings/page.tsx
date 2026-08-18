import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import DailyStudentRatingsView from '@/components/dashboard/teacher/DailyStudentRatingsView'
import { TEACHER_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function DailyRatingsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'teacher') redirect('/management')

  const initials = getInitials(session.user.name ?? 'TC')
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar userName={session.user.name ?? ''} userRole="Faculty Portal" navItems={TEACHER_NAV} initials={initials} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <DailyStudentRatingsView />
      </div>
    </div>
  )
}
