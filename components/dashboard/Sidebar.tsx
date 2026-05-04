'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { HelpCircle, LogOut } from 'lucide-react'
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
      className="w-64 shrink-0 bg-white/70 backdrop-blur-md border-r border-gray-200/50 min-h-screen flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]"
    >
      {/* Identity */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-200"
          >
            {initials}
          </motion.div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">Academic System</p>
            <p className="text-[11px] font-medium text-indigo-500 uppercase tracking-wider truncate">{userRole}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}>
              <motion.div 
                whileHover={{ x: 4 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all group ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}>
                <span className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'}`}>
                  {item.icon}
                </span>
                {item.label}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-6 border-t border-gray-100/50 space-y-1">
        <Link href="/support">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
            <HelpCircle className="w-4 h-4 shrink-0 text-gray-400" />
            Support Center
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  )
}
