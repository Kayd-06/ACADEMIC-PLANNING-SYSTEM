import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutDashboard, School, ShieldCheck, Users, BookOpen } from 'lucide-react'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import InstitutionalDashboard from '@/components/dashboard/management/InstitutionalDashboard'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const NAV = [
  { label: 'Dashboard', href: '/management', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'School Background', href: '/management/school', icon: <School className="w-4 h-4" /> },
  { label: 'Protocols', href: '/management/protocols', icon: <ShieldCheck className="w-4 h-4" /> },
  { label: 'Recruitment', href: '/management/recruitment', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/management/academic-planning', icon: <BookOpen className="w-4 h-4" /> },
]

export default async function ManagementPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const initials = getInitials(session.user.name ?? 'EA')
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={session.user.name ?? ''} userRole="Academic Administration" navItems={NAV} initials={initials} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <InstitutionalDashboard />
      </div>
    </div>
  )
}
