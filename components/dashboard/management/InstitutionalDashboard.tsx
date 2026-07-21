'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Building2, Zap, FileText, CalendarClock, Plus, ChevronRight, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Copy, Check, Megaphone, Bell, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import SchoolDetailsModal from './SchoolDetailsModal'
import ProtocolsModal from './ProtocolsModal'
import AnnouncementsView from './AnnouncementsView'
import ScheduleManagementView from './ScheduleManagementView'
import { getLocalToday, buildTodaysClasses, type TodayClassEntry } from '@/lib/scheduleUtils'
import { formatClasses, formatMouStatus } from './SchoolFormHelpers'
import { formatDate } from '@/lib/date'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 320, damping: 28 },
})

interface Protocol {
  _id: string
  label: string
  sub: string
  status: 'completed' | 'pending' | 'overdue'
}

export default function InstitutionalDashboard() {
  const { data: session } = useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProtocolsModalOpen, setIsProtocolsModalOpen] = useState(false)
  const [schoolData, setSchoolData] = useState<{
    name?: string; board: string; classes: string; programs: string
    mouStartDate: string | null; mouEndDate: string | null; joinCode: string
    contactPerson?: string; phone?: string | null; email?: string; address?: string; gstNo?: string
  } | null>(null)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [codeCopied, setCodeCopied] = useState(false)
  const [todaysSchedule, setTodaysSchedule] = useState<TodayClassEntry[]>([])
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null)
  const [isManageAnnouncementsOpen, setIsManageAnnouncementsOpen] = useState(false)
  const [isManageScheduleOpen, setIsManageScheduleOpen] = useState(false)

  async function fetchAnnouncements() {
    const res = await fetch('/api/announcements')
    const data = await res.json()
    if (Array.isArray(data)) setAnnouncements(data)
  }

  async function refreshTodaysSchedule() {
    const todayIso = getLocalToday()
    const todayDow = new Date().getDay()
    const [regular, special] = await Promise.all([
      fetch('/api/schedule?activeOnly=true').then(r => r.ok ? r.json() : []),
      fetch(`/api/special-classes?date=${todayIso}`).then(r => r.ok ? r.json() : []),
    ])
    setTodaysSchedule(buildTodaysClasses(
      Array.isArray(regular) ? regular : [],
      Array.isArray(special) ? special : [],
      todayIso, todayDow, true
    ))
  }

  useEffect(() => {
    fetch('/api/school')
      .then(res => res.json())
      .then(data => { if (!data.error) setSchoolData(data) })
      .finally(() => setSchoolLoading(false))
    fetchProtocols()
    fetchAnnouncements()
    refreshTodaysSchedule()
  }, [])

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
    if (!session?.user?.email) return
    const updated = [...readIds, id]
    setReadIds(updated)
    localStorage.setItem(`read_announcements_${session.user.email}`, JSON.stringify(updated))
  }

  async function fetchProtocols() {
    const res = await fetch('/api/protocols')
    const data = await res.json()
    if (!data.error) setProtocols(data)
  }

  async function handleSave(newData: any) {
    const res = await fetch('/api/school', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    })
    const data = await res.json()
    if (!data.error) setSchoolData(data)
  }

  function copyCode() {
    if (!schoolData?.joinCode) return
    navigator.clipboard.writeText(schoolData.joinCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const protocolIcon = (status: Protocol['status']) => {
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    if (status === 'overdue') return <AlertTriangle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-[#1a365d]" />
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <SchoolDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={schoolData ?? { board: '', classes: '', programs: '', mouStartDate: '', mouEndDate: '', contactPerson: '', phone: '', email: '', address: '', gstNo: '' }}
        onSave={handleSave}
      />
      <ProtocolsModal
        isOpen={isProtocolsModalOpen}
        onClose={() => setIsProtocolsModalOpen(false)}
        onUpdate={fetchProtocols}
      />

      {/* Page title */}
      <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Institutional Dashboard
            {schoolData?.name && (
              <>
                <span className="text-slate-300 font-normal mx-2.5">•</span>
                <span className="text-indigo-600 font-extrabold">{schoolData.name}</span>
              </>
            )}
          </h1>
          <p className="text-[13px] font-medium text-slate-500 mt-1">Overview of academic background, protocols, and ongoing management tasks</p>
        </div>
        <Link href="/management/recruitment">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 bg-[#0b1320] hover:bg-[#1a2333] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            New Recruitment
          </motion.div>
        </Link>
      </motion.div>

      {/* Top grid: School Background + Quick Actions + Protocols */}
      <div className="grid grid-cols-12 gap-4 mb-4">

        {/* School Background — 7 cols */}
        <motion.div {...fadeUp(0.04)} className="col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
              <Building2 className="w-5 h-5 text-slate-700" /> School Background
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {schoolLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl p-4 border border-slate-100 bg-slate-50/70">
                  <div className="h-2.5 w-20 rounded bg-slate-200 animate-pulse mb-2.5" />
                  <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                </div>
              ))
            ) : (
              [
                { label: 'CURRENT BOARD', value: schoolData?.board || 'Not set' },
                { label: 'ACTIVE CLASSES', value: schoolData?.classes ? formatClasses(schoolData.classes) : 'Not set' },
                { label: 'PROGRAMS OFFERED', value: schoolData?.programs || 'Not set' },
                { label: 'MOU STATUS', value: formatMouStatus(schoolData?.mouStartDate, schoolData?.mouEndDate), primary: true },
              ].map(item => (
                <div key={item.label} className={`rounded-xl p-4 border flex flex-col justify-center relative ${item.primary ? 'bg-indigo-50/40 border-indigo-200/60' : 'bg-slate-50/70 border-slate-100'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${item.primary ? 'text-indigo-600' : 'text-slate-500'}`}>{item.label}</p>
                  <p className="text-[13px] font-bold text-slate-800">
                    {item.value}
                  </p>
                  {item.primary && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-indigo-600 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {schoolData?.joinCode && (
            <div className="mt-4 rounded-xl p-4 border border-amber-200 bg-amber-50/60 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">School Invite Code</p>
                <p className="text-[15px] font-black text-amber-900 tracking-widest font-mono">{schoolData.joinCode}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Share this code with teachers &amp; staff to join your school</p>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[12px] font-bold transition-all"
              >
                {codeCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
          )}
        </motion.div>

        {/* Quick Actions — 3 cols */}
        <motion.div {...fadeUp(0.08)} className="col-span-3 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] mb-5">
            <Zap className="w-5 h-5 text-slate-700" /> Quick Actions
          </div>
          <div className="space-y-3">
            {[
              { label: 'Initiate Recruitment', href: '/management/recruitment', icon: <Plus className="w-4 h-4 text-indigo-600" /> },
              { label: 'Update Macro Plan', href: '/management/academic-planning', icon: <Clock className="w-4 h-4 text-indigo-600" /> },
              { label: 'Upload Compliance Doc', href: '#', onClick: () => setIsProtocolsModalOpen(true), icon: <FileText className="w-4 h-4 text-indigo-600" /> },
            ].map(action => (
              action.href !== '#' ? (
                <Link key={action.label} href={action.href!} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-left">
                  <div className="flex items-center gap-3 text-[13px] font-bold text-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      {action.icon}
                    </div>
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </Link>
              ) : (
                <button key={action.label} onClick={action.onClick} className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-left cursor-pointer">
                  <div className="flex items-center gap-3 text-[13px] font-bold text-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      {action.icon}
                    </div>
                    {action.label}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </button>
              )
            ))}
          </div>
        </motion.div>

        {/* Announcements — 2 cols */}
        <motion.div {...fadeUp(0.12)} className="col-span-2 bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
                <Bell className="w-5 h-5 text-slate-500" /> Announcements
              </div>
            </div>
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <p className="text-[12px] text-slate-400 italic py-4 text-center">No recent announcements</p>
              ) : (
                announcements.slice(0, 3).map((ann, i) => {
                  const title = ann.title || ann.label || 'Announcement'
                  const isUrgent = ann.type === 'Urgent' || ann.urgent
                  const isRead = readIds.includes(ann.id || ann._id)
                  const dateStr = ann.createdAt ? formatDate(ann.createdAt) : 'Recent'
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
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setIsManageAnnouncementsOpen(true)}
              className="text-[13px] text-[#0b1320] hover:text-slate-800 font-bold transition-colors border-none bg-transparent cursor-pointer"
            >
              Manage All
            </button>
          </div>
        </motion.div>
      </div>
      {/* Today's Class Schedule — across every faculty member in the school */}
      <motion.div {...fadeUp(0.16)} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px]">
            <CalendarClock className="w-5 h-5 text-slate-700" /> Today's Class Schedule
          </div>
          <button
            onClick={() => setIsManageScheduleOpen(true)}
            className="text-[13px] font-bold text-indigo-600 hover:text-indigo-700 bg-transparent border-none cursor-pointer"
          >
            Manage Schedule
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {['Time', 'Class', 'Batch', 'Teacher', 'Room'].map(h => (
                <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todaysSchedule.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 italic">No classes scheduled today.</td>
              </tr>
            ) : todaysSchedule.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-6 py-4 text-[13px] text-slate-600 font-medium whitespace-nowrap">{row.time}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-slate-800 font-bold">{row.title}</span>
                    {row.type && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 uppercase">{row.type}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-[13px] text-slate-600 font-medium">{row.batch || '—'}</td>
                <td className="px-6 py-4 text-[13px] font-semibold text-slate-800">{row.teacherName || '—'}</td>
                <td className="px-6 py-4 text-[13px] text-slate-600">{row.room || '—'}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400">© 2024 EduAdmin Management System. Institutional Grade Security.</p>
        </div>
      </motion.div>

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
                    ? formatDate(selectedAnnouncement.createdAt)
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

      {/* Manage Announcements Modal */}
      <AnimatePresence>
        {isManageAnnouncementsOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" /> Manage Announcements
                </h3>
                <button
                  onClick={() => {
                    setIsManageAnnouncementsOpen(false)
                    fetchAnnouncements()
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Contains the view */}
              <div className="flex-1 overflow-hidden relative">
                <AnnouncementsView />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Schedule Modal */}
      <AnimatePresence>
        {isManageScheduleOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Schedule & Timetable Management</h3>
                    <p className="text-[11px] text-slate-500">Add, edit, and assign schedules across your connected schools</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsManageScheduleOpen(false)
                    refreshTodaysSchedule()
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                <ScheduleManagementView onUpdate={refreshTodaysSchedule} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
