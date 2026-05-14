import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/dashboard/Sidebar'
import TopHeader from '@/components/dashboard/TopHeader'
import { MANAGEMENT_NAV } from '@/lib/navigation'
import { ShieldCheck } from 'lucide-react'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default async function QualityPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const initials = getInitials(session.user.name ?? 'EA')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar userName={session.user.name ?? ''} userRole="Academic Administration" navItems={MANAGEMENT_NAV} initials={initials} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader initials={initials} />
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quality Monitoring</h1>
          <p className="text-gray-500 max-w-sm">This module is currently being configured for institutional audits and performance tracking.</p>
        </div>
      </div>
    </div>
  )
}
