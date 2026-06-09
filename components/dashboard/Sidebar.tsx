'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { HelpCircle, LogOut, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [showRecruitmentModal, setShowRecruitmentModal] = useState(false)
  const [requirementForm, setRequirementForm] = useState({ title: '', department: '', openPositions: 1 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreateRequirement() {
    if (!requirementForm.title || !requirementForm.department) return
    setIsSubmitting(true)
    await fetch('/api/recruitment/requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requirementForm)
    })
    setRequirementForm({ title: '', department: '', openPositions: 1 })
    setShowRecruitmentModal(false)
    setIsSubmitting(false)
    window.dispatchEvent(new Event('requirementsUpdated'))
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 h-screen sticky top-0 flex flex-col print:hidden"
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
          <motion.button
            onClick={() => setShowRecruitmentModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#002045] hover:bg-[#1a365d] text-white text-[13px] font-bold shadow-sm transition-all mb-3"
          >
            <Plus className="w-4 h-4" />
            New Recruitment
          </motion.button>
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

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showRecruitmentModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md border border-slate-100"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900">New Requirement Announcement</h3>
                  <button onClick={() => setShowRecruitmentModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role Title</label>
                    <input 
                      value={requirementForm.title}
                      onChange={(e) => setRequirementForm({...requirementForm, title: e.target.value})}
                      placeholder="e.g. Associate Professor" 
                      className="w-full mt-1 px-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <input 
                      value={requirementForm.department}
                      onChange={(e) => setRequirementForm({...requirementForm, department: e.target.value})}
                      placeholder="e.g. Computer Science" 
                      className="w-full mt-1 px-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Positions</label>
                    <input 
                      type="number" 
                      value={requirementForm.openPositions}
                      onChange={(e) => setRequirementForm({...requirementForm, openPositions: parseInt(e.target.value) || 1})}
                      min={1}
                      className="w-full mt-1 px-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002045]/20" 
                    />
                  </div>
                  <button 
                    onClick={handleCreateRequirement} 
                    disabled={isSubmitting}
                    className="w-full bg-[#002045] text-white font-bold py-2.5 rounded-xl hover:bg-[#1a365d] transition-colors mt-2 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Announcement'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.aside>
  )
}
