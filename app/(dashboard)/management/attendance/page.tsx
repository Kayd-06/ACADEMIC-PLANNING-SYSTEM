import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import AttendanceOverviewView from '@/components/dashboard/management/AttendanceOverviewView'
import { MANAGEMENT_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function ManagementAttendanceOverviewPage() {
  const session = await auth()
  if (!session) redirect('/login')
  
  const initials = getInitials(session.user.name ?? 'EA')
  
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
        <AttendanceOverviewView />
      </div>
    </div>
  )
}
