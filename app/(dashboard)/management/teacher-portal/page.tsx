import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import TeacherPortalDashboard from '@/components/dashboard/management/TeacherPortalDashboard'
import { MANAGEMENT_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function TeacherPortalPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const initials = getInitials(session.user.name ?? 'EA')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={session.user.name ?? ''} userRole="Academic Administration" navItems={MANAGEMENT_NAV} initials={initials} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <TeacherPortalDashboard teacherName={session.user.name ?? 'Administrator'} />
      </div>
    </div>
  )
}
