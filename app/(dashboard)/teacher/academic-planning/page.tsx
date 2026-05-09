import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutDashboard, BookOpen, Calendar, Users, GraduationCap } from 'lucide-react'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import AcademicPlanning from '@/components/dashboard/AcademicPlanning'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const NAV = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'My Courses', href: '/teacher/courses', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Schedule', href: '/teacher/schedule', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Students', href: '/teacher/students', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/teacher/academic-planning', icon: <GraduationCap className="w-4 h-4" /> },
]

export default async function TeacherAcademicPlanningPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const initials = getInitials(session.user.name ?? 'TC')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={session.user.name ?? ''} userRole="Faculty" navItems={NAV} initials={initials} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <AcademicPlanning role="teacher" />
      </div>
    </div>
  )
}
