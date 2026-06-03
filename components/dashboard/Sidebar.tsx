'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { HelpCircle, LogOut, Plus } from 'lucide-react'
import { motion } from 'framer-motion'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarProps {
  userName: string
  userRole: string
  navItems: NavItem[]
  initials: string
}

export default function Sidebar({ userName, userRole, navItems, initials }: SidebarProps) {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 min-h-screen flex flex-col"
    >
      {/* Identity */}
      <div className="px-6 pb-6 pt-6 mb-2 border-b border-slate-200 flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 5, scale: 1.05 }}
          className="w-10 h-10 rounded-xl bg-[#002045] flex items-center justify-center text-white text-sm font-bold shadow-md"
        >
          {initials}
        </motion.div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">EduAdmin Pro</p>
          <p className="text-[11px] font-medium text-slate-500 truncate">{userRole}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-md text-[13px] font-medium transition-all group ${
                  active
                    ? 'bg-blue-50 text-[#002045] font-semibold border-r-4 border-[#002045]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-[#002045]' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {item.icon}
                </span>
                {item.label}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-6 border-t border-slate-200 space-y-1">
        {userRole !== 'Faculty' && (
          <Link href="/management/recruitment">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#002045] hover:bg-[#1a365d] text-white text-[13px] font-bold shadow-sm transition-all mb-3"
            >
              <Plus className="w-4 h-4" />
              New Recruitment
            </motion.button>
          </Link>
        )}
        <Link href="/support">
          <div className="flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
            <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
            Support
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-4 py-2 mx-2 rounded-md text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
