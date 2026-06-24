import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import AnnouncementsView from '@/components/dashboard/management/AnnouncementsView'
import { MANAGEMENT_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function ManagementAnnouncementsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  
  const role = (session.user as any).role
  if (role !== 'management') redirect('/login')

  const initials = getInitials(session.user.name ?? 'AD')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        userName={session.user.name ?? ''} 
        userRole="School Management" 
        navItems={MANAGEMENT_NAV} 
        initials={initials} 
      />
      <div className="flex-1 flex flex-col min-w-0 font-sans">
        <TopHeader initials={initials} />
        <AnnouncementsView />
      </div>
    </div>
  )
}
