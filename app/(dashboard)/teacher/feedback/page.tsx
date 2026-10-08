import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import TeacherFeedbackView from '@/components/dashboard/teacher/TeacherFeedbackView'
import { TEACHER_NAV } from '@/lib/navigation'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function FeedbackPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // Management has its own feedback console; this page posts as Teacher -> Management
  if (session.user.role === 'management') redirect('/management/feedback')
  if (session.user.role !== 'teacher') redirect('/')

  const initials = getInitials(session.user.name ?? 'EA')
  
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        userName={session.user.name ?? ''} 
        userRole="Faculty"
        navItems={TEACHER_NAV} 
        initials={initials} 
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <TeacherFeedbackView />
      </div>
    </div>
  )
}
