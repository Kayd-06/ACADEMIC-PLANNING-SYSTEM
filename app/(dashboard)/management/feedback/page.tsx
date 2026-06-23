import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import FeedbackManagementView from '@/components/dashboard/management/FeedbackManagementView'
import { MANAGEMENT_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function ManagementFeedbackPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'management') redirect('/login')

  const initials = getInitials(session.user.name ?? 'AD')

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        userName={session.user.name ?? ''} 
        userRole="Academic Administration" 
        navItems={MANAGEMENT_NAV} 
        initials={initials} 
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader initials={initials} />
        <FeedbackManagementView />
      </div>
    </div>
  )
}
