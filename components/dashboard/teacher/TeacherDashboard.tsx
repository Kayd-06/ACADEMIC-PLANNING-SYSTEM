'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Users, Calendar, ClipboardList, ChevronRight, Plus, Filter, Building2, ShieldCheck, CheckCircle2, AlertTriangle, Clock, Megaphone, Bell } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { getLocalToday, buildTodaysClasses } from '@/lib/scheduleUtils'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

export default function TeacherDashboard({ firstName }: { firstName: string }) {
  const { data: session } = useSession()
  const [schoolData, setSchoolData] = useState<any>(null)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [protocols, setProtocols] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [stats, setStats] = useState({ pendingDailyReports: 0, assignmentsToGrade: 0, upcomingTests: 0 })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)

  useEffect(() => {
    if (session?.user?.email) {
      const stored = localStorage.getItem(`read_announcements_${session.user.email}`)
      if (stored) {
        try {
          setReadIds(JSON.parse(stored))
        } catch (e) {
          console.error(e)
        }
      }
    }
  }, [session])

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return
    const updated = [...readIds, id]
    setReadIds(updated)
    if (session?.user?.email) {
      localStorage.setItem(`read_announcements_${session.user.email}`, JSON.stringify(updated))
    }
  }

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setSchoolData(data)
      })
      .finally(() => setSchoolLoading(false))
    fetch('/api/protocols')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setProtocols(data)
      })
    const todayIso = getLocalToday()
    const todayDow = new Date().getDay()
    Promise.all([
      fetch('/api/schedule?mine=true&activeOnly=true').then(r => r.ok ? r.json() : []),
      fetch(`/api/special-classes?mine=true&date=${todayIso}`).then(r => r.ok ? r.json() : []),
    ]).then(([regular, special]) => {
      setSchedules(buildTodaysClasses(
        Array.isArray(regular) ? regular : [],
        Array.isArray(special) ? special : [],
        todayIso, todayDow
      ))
    }).catch(() => {})
    fetch('/api/announcements')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAnnouncements(data)
      })
    fetch('/api/teacher-portal/dashboard-stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !data.error) setStats(data)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex-1 p-6 overflow-auto bg-slate-50/50">
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • You have {schedules.length} classes today
          </p>
        </div>
        <Link href="/teacher/daily-report">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 bg-[#002045] hover:bg-[#1a365d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Class Note
          </motion.div>
        </Link>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Institutional Info Card — 8 cols */}
        <motion.div {...fadeUp(0.05)} className="col-span-8 bg-[#002045]/5 border border-[#002045]/10 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white border border-[#002045]/20 flex items-center justify-center text-[#002045] shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#002045] uppercase tracking-wider">Institution Information</p>
              {schoolLoading ? (
                <span className="block h-3.5 w-36 rounded bg-gray-200 animate-pulse mt-1" />
              ) : (
                <p className="text-sm font-bold text-gray-900">{schoolData?.name || 'Not set'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Board</p>
              {schoolLoading ? (
                <span className="block h-3 w-20 rounded bg-gray-200 animate-pulse mt-1" />
              ) : (
                <p className="text-xs font-bold text-gray-800">{schoolData?.board || 'Not set'}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Classes</p>
              {schoolLoading ? (
                <span className="block h-3 w-20 rounded bg-gray-200 animate-pulse mt-1" />
              ) : (
                <p className="text-xs font-bold text-gray-800">{schoolData?.classes || 'Not set'}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">MOU Status</p>
              {schoolLoading ? (
                <span className="block h-3 w-20 rounded bg-gray-200 animate-pulse mt-1" />
              ) : (
                <p className="text-xs font-bold text-emerald-700">{schoolData?.mouStatus || 'Not set'}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Announcements Card — 4 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-4 bg-white border border-gray-100 rounded-xl p-5 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] mb-5 shrink-0">
            <Bell className="w-5 h-5 text-slate-500" /> Announcements
          </div>
          <div className="space-y-3 mt-4 flex-1 overflow-y-auto max-h-[140px] pr-0.5 custom-scrollbar">
            {announcements.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic">No recent announcements</p>
            ) : (
              announcements.slice(0, 3).map((ann, i) => {
                const title = ann.title || ann.label || 'Announcement'
                const isUrgent = ann.type === 'Urgent' || ann.urgent
                const isRead = readIds.includes(ann.id || ann._id)
                const dateStr = ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'
                return (
                  <div
                    key={ann._id || ann.id || i}
                    onClick={() => setSelectedAnnouncement(ann)}
                    className="flex gap-2.5 items-start cursor-pointer hover:bg-slate-50/70 p-2 rounded-xl border border-slate-50 transition-all"
                  >
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      isRead ? 'bg-transparent' : isUrgent ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${isUrgent ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                          {ann.type || (isUrgent ? 'Urgent' : 'General')}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 ml-auto">{dateStr}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate mt-1 leading-snug">{title}</h4>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <motion.div {...fadeUp(0.05)} className="bg-[#0b1320] rounded-xl p-5 shadow-sm text-white relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold leading-none mb-1">{schedules.length}</p>
          <p className="text-[13px] font-medium text-slate-300">Today's Classes</p>
        </motion.div>

        <motion.div {...fadeUp(0.1)} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 leading-none mb-1">{stats.pendingDailyReports}</p>
          <p className="text-[13px] font-bold text-slate-500">Pending Daily Reports</p>
        </motion.div>

        <motion.div {...fadeUp(0.15)} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 leading-none mb-1">{stats.assignmentsToGrade}</p>
          <p className="text-[13px] font-bold text-slate-500">Assignments to Grade</p>
        </motion.div>

        <motion.div {...fadeUp(0.2)} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 leading-none mb-1">{stats.upcomingTests}</p>
          <p className="text-[13px] font-bold text-slate-500">Upcoming Tests</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (Schedule) */}
        <div className="col-span-8">
          <motion.div {...fadeUp(0.22)}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-bold text-slate-900">Today's Schedule</h2>
              <Link href="/teacher/schedule" className="text-[13px] font-bold text-indigo-600 hover:text-indigo-700">
                View Full Week
              </Link>
            </div>
            <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[21px] before:w-0.5 before:bg-slate-100">
              {schedules.length === 0 && (
                <p className="pl-10 text-sm text-slate-400 italic">No classes scheduled today.</p>
              )}
              {schedules.map((row, i) => (
                <div key={row.id || i} className="relative pl-10">
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 bg-indigo-600 ring-indigo-100" />

                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">{row.time}</p>
                          {row.type && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">{row.type}</span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold text-slate-900">{row.title}</h3>
                        <p className="text-[13px] font-medium text-slate-600 mt-1">
                          {[row.batch, row.type ? row.subject : null].filter(Boolean).join(' • ')} • <span className="text-slate-400">{row.room || 'No room set'}</span>
                        </p>
                      </div>
                      <Link href={`/teacher/attendance?date=${row.date}&batch=${encodeURIComponent(row.batch)}&subject=${encodeURIComponent(row.subject)}&classTime=${encodeURIComponent(row.time)}`}>
                        <span className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold rounded-lg transition-colors inline-block cursor-pointer">
                          Mark Attendance
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Column (Actions & Announcements) */}
        <div className="col-span-4 space-y-6">
          <motion.div {...fadeUp(0.25)} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: 'Submit Daily Report', href: '/teacher/daily-report', icon: <ClipboardList className="w-4 h-4 text-indigo-600" /> },
                { label: 'Upload Material', href: '/teacher/courses', icon: <BookOpen className="w-4 h-4 text-emerald-600" /> },
                { label: 'Create Assignment', href: '/teacher/assignments', icon: <Plus className="w-4 h-4 text-amber-600" /> },
              ].map(action => (
                <Link key={action.label} href={action.href} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-left group bg-slate-50/50">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                    {action.icon}
                  </div>
                  <span className="text-[13px] font-bold text-slate-700 group-hover:text-slate-900">{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Announcement Modal Popup */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  selectedAnnouncement.type === 'Urgent' || selectedAnnouncement.urgent
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {selectedAnnouncement.type || (selectedAnnouncement.urgent ? 'Urgent' : 'General')}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {selectedAnnouncement.createdAt
                    ? new Date(selectedAnnouncement.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recent'
                  }
                </span>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {selectedAnnouncement.title || selectedAnnouncement.label}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {selectedAnnouncement.content || selectedAnnouncement.sub}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                {!readIds.includes(selectedAnnouncement.id || selectedAnnouncement._id) && (
                  <button
                    onClick={() => {
                      markAsRead(selectedAnnouncement.id || selectedAnnouncement._id)
                      setSelectedAnnouncement(null)
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    Mark as Read
                  </button>
                )}
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  )
}
