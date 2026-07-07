'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Plus, X, Building2, ChevronDown, Check, Loader2, ArrowRightLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type SchoolEntry = { id: string; name: string; role: string }

function SchoolSwitcher() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [schools, setSchools] = useState<SchoolEntry[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const activeSchoolId = (session?.user as any)?.schoolId as string | null

  useEffect(() => {
    fetch('/api/admin/schools')
      .then(r => {
        if (!r.ok) return r.text().then(txt => { throw new Error(txt || 'Failed to fetch') })
        return r.json()
      })
      .then(d => { if (d && !d.error) setSchools(d) })
      .catch(err => console.error('SchoolSwitcher fetch error:', err))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeSchool = schools.find(s => s.id === activeSchoolId)

  async function switchSchool(schoolId: string) {
    if (schoolId === activeSchoolId) { setOpen(false); return }
    setSwitching(schoolId)
    try {
      const res = await fetch('/api/admin/active-school', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId })
      })
      const data = await res.json()
      if (!data.error) { await update({ schoolId }); window.location.reload() }
    } finally { setSwitching(null); setOpen(false) }
  }

  return (
    <div className="px-4 pb-3" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-all text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-[12px] font-semibold text-slate-700 truncate">{activeSchool?.name ?? 'No school selected'}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="py-1">
              {schools.length === 0 && <p className="px-4 py-3 text-xs text-slate-400 italic">No schools found</p>}
              {schools.map(school => (
                <button key={school.id} onClick={() => switchSchool(school.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors ${school.id === activeSchoolId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span className="truncate text-left">{school.name}</span>
                  {switching === school.id ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : school.id === activeSchoolId ? <Check className="w-3.5 h-3.5 shrink-0" /> : <ArrowRightLeft className="w-3 h-3 text-slate-300 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100">
              <Link href="/management/academic-planning" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Manage Schools
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
      <div className="px-6 pb-6 pt-6 mb-2 flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 5, scale: 1.05 }}
          className="w-10 h-10 rounded-xl bg-[#0b1320] flex items-center justify-center text-white text-sm font-bold shadow-sm"
        >
          {initials}
        </motion.div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-slate-900 tracking-tight truncate">EduAdmin Pro</p>
          <p className="text-[12px] font-medium text-slate-500 truncate">{userRole === 'Academic Administration' ? 'School Management' : userRole}</p>
        </div>
      </div>

      {/* School switcher — management only */}
      {userRole === 'Academic Administration' && <SchoolSwitcher />}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          const active = pathname === item.href
          return (
            <Link key={`${item.label}-${index}`} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md text-[13px] font-medium transition-all group ${
                  active
                    ? 'bg-slate-100/80 text-[#0b1320] font-bold border-l-4 border-[#0b1320] pl-3'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-[#0b1320]' : 'text-slate-400 group-hover:text-slate-500'}`}>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b1320] hover:bg-[#1a2333] text-white text-[13px] font-bold shadow-sm transition-all mb-3"
          >
            <Plus className="w-4 h-4" />
            New Recruitment
          </motion.button>
        )}

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
